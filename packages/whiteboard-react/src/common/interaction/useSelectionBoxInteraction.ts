import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { rectFromPoints } from '@whiteboard/core/geometry'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'

type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

type ActiveSelection = {
  pointerId: number
  mode: SelectionMode
  startScreen: Point
  startWorld: Point
  isSelecting: boolean
  baseSelectedNodeIds: Set<NodeId>
  latestMatchedIds?: NodeId[]
  frameId?: number
  lastSelectionKey: string
}

const resolveSelectionMode = (
  event: Pick<PointerEvent | ReactPointerEvent<HTMLElement>, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>
): SelectionMode => {
  if (event.altKey) return 'subtract'
  if (event.metaKey || event.ctrlKey) return 'toggle'
  if (event.shiftKey) return 'add'
  return 'replace'
}

const applySelection = (
  prevSelectedIds: Set<NodeId>,
  ids: NodeId[],
  mode: SelectionMode
): Set<NodeId> => {
  if (mode === 'replace') {
    return new Set(ids)
  }

  const next = new Set(prevSelectedIds)
  if (mode === 'add') {
    ids.forEach((id) => next.add(id))
    return next
  }

  if (mode === 'subtract') {
    ids.forEach((id) => next.delete(id))
    return next
  }

  ids.forEach((id) => {
    if (next.has(id)) {
      next.delete(id)
      return
    }
    next.add(id)
  })
  return next
}

const toSelectionKey = (selectedIds: Set<NodeId>) =>
  Array.from(selectedIds).sort().join('|')

const isBackgroundPointerTarget = (
  target: EventTarget | null,
  currentTarget: EventTarget & HTMLDivElement
) => {
  if (!(target instanceof Element)) return false
  if (!currentTarget.contains(target)) return false

  if (
    target.closest(
      '[data-selection-ignore], [data-input-ignore], [data-input-role], [data-node-id], [data-edge-id]'
    )
  ) {
    return false
  }
  if (
    target.closest(
      'input,textarea,select,button,a[href],[contenteditable=""],[contenteditable="true"]'
    )
  ) {
    return false
  }
  return true
}

const toScreenWorld = (
  clientX: number,
  clientY: number,
  clientToScreen: (clientX: number, clientY: number) => Point,
  screenToWorld: (screen: Point) => Point
) => {
  const screen = clientToScreen(clientX, clientY)
  return {
    screen,
    world: screenToWorld(screen)
  }
}

type UseSelectionBoxInteractionResult = {
  selectionRect?: Rect
  handleViewportPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

export const useSelectionBoxInteraction = (
  instance: Instance
): UseSelectionBoxInteractionResult => {
  const activeRef = useRef<ActiveSelection | null>(null)
  const [selectionRect, setSelectionRect] = useState<Rect | undefined>(undefined)

  const clearFrame = (active: ActiveSelection) => {
    if (active.frameId === undefined || typeof window === 'undefined') return
    window.cancelAnimationFrame(active.frameId)
    active.frameId = undefined
  }

  const flushSelection = useCallback(() => {
    const active = activeRef.current
    if (!active || !active.latestMatchedIds) return
    const nextSelected = applySelection(
      active.baseSelectedNodeIds,
      active.latestMatchedIds,
      active.mode
    )
    const nextKey = toSelectionKey(nextSelected)
    if (nextKey === active.lastSelectionKey) return
    active.lastSelectionKey = nextKey
    instance.commands.selection.select(Array.from(nextSelected), 'replace')
  }, [instance.commands.selection])

  const scheduleFlush = useCallback(() => {
    const active = activeRef.current
    if (!active || typeof window === 'undefined') return
    if (active.frameId !== undefined) return
    active.frameId = window.requestAnimationFrame(() => {
      const next = activeRef.current
      if (!next) return
      next.frameId = undefined
      flushSelection()
    })
  }, [flushSelection])

  const clearSelectionBox = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (!active) return
    if (pointerId !== undefined && active.pointerId !== pointerId) return
    clearFrame(active)
    activeRef.current = null
    setSelectionRect(undefined)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePointerMove = (event: PointerEvent) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      const minDragDistance = instance.query.config.get().node.selectionMinDragDistance
      const resolved = toScreenWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )
      const dx = Math.abs(resolved.screen.x - active.startScreen.x)
      const dy = Math.abs(resolved.screen.y - active.startScreen.y)
      if (!active.isSelecting && dx < minDragDistance && dy < minDragDistance) {
        return
      }

      active.isSelecting = true
      setSelectionRect(rectFromPoints(active.startScreen, resolved.screen))
      const worldRect = rectFromPoints(active.startWorld, resolved.world)
      active.latestMatchedIds = instance.query.canvas.nodeIdsInRect(worldRect)
      scheduleFlush()
    }

    const handlePointerUp = (event: PointerEvent) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      if (active.isSelecting) {
        const resolved = toScreenWorld(
          event.clientX,
          event.clientY,
          instance.query.viewport.clientToScreen,
          instance.query.viewport.screenToWorld
        )
        const worldRect = rectFromPoints(active.startWorld, resolved.world)
        active.latestMatchedIds = instance.query.canvas.nodeIdsInRect(worldRect)
        flushSelection()
      } else if (active.mode === 'replace') {
        instance.commands.selection.clear()
      }

      clearSelectionBox(active.pointerId)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      clearSelectionBox(active.pointerId)
    }

    const handleBlur = () => {
      clearSelectionBox()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      clearSelectionBox()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    clearSelectionBox,
    flushSelection,
    instance.commands.selection,
    instance.query.canvas,
    instance.query.config,
    instance.query.viewport,
    scheduleFlush
  ])

  useEffect(
    () => () => {
      clearSelectionBox()
    },
    [clearSelectionBox]
  )

  const handleViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.state.read('tool') === 'edge') return
      if (instance.render.read('spacePressed')) return
      if (!isBackgroundPointerTarget(event.target, event.currentTarget)) return

      const mode = resolveSelectionMode(event)
      const resolved = toScreenWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )
      instance.commands.edge.select(undefined)
      const selectedNodeIds = instance.state.read('selection').selectedNodeIds
      activeRef.current = {
        pointerId: event.pointerId,
        mode,
        startScreen: resolved.screen,
        startWorld: resolved.world,
        isSelecting: false,
        baseSelectedNodeIds: new Set(selectedNodeIds),
        lastSelectionKey: toSelectionKey(selectedNodeIds)
      }
      setSelectionRect(undefined)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle lifecycle.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [instance]
  )

  return {
    selectionRect,
    handleViewportPointerDown
  }
}
