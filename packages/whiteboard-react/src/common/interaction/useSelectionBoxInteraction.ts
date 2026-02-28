import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { rectFromPoints } from '@whiteboard/core/geometry'
import { applySelection, resolveSelectionMode, type SelectionMode } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'
import { sessionLockState, type SessionLockToken } from './sessionLockState'
import { selectionBoxState } from './selectionBoxState'
import { useWindowPointerSession } from './useWindowPointerSession'
import { viewportGestureState } from './viewportGestureState'

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
  handleViewportPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

export const useSelectionBoxInteraction = (
  instance: Instance
): UseSelectionBoxInteractionResult => {
  const activeRef = useRef<ActiveSelection | null>(null)
  const lockTokenRef = useRef<SessionLockToken | null>(null)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)

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

  const releaseSessionLock = useCallback((pointerId?: number) => {
    const lockToken = lockTokenRef.current
    if (!lockToken) return
    if (
      pointerId !== undefined
      && lockToken.pointerId !== undefined
      && lockToken.pointerId !== pointerId
    ) {
      return
    }
    sessionLockState.release(instance, lockToken)
    lockTokenRef.current = null
  }, [instance])

  const clearSelectionBox = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (!active) {
      releaseSessionLock(pointerId)
      return
    }
    if (pointerId !== undefined && active.pointerId !== pointerId) return
    clearFrame(active)
    activeRef.current = null
    setActivePointerId(null)
    selectionBoxState.clear(instance)
    if (active.isSelecting) {
      const pointer = instance.state.read('interaction').pointer
      instance.commands.interaction.update({
        pointer: {
          ...pointer,
          isDragging: false
        }
      })
    }
    releaseSessionLock(active.pointerId)
  }, [instance, instance.commands.interaction, releaseSessionLock])

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
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

      if (!active.isSelecting) {
        const pointer = instance.state.read('interaction').pointer
        instance.commands.interaction.update({
          pointer: {
            ...pointer,
            isDragging: true
          }
        })
      }
      active.isSelecting = true
      selectionBoxState.setRect(instance, rectFromPoints(active.startScreen, resolved.screen))
      const worldRect = rectFromPoints(active.startWorld, resolved.world)
      active.latestMatchedIds = instance.query.canvas.nodeIdsInRect(worldRect)
      scheduleFlush()
    },
    onPointerUp: (event) => {
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
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      clearSelectionBox(active.pointerId)
    },
    onBlur: () => {
      clearSelectionBox()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clearSelectionBox()
    }
  })

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
      if (viewportGestureState.isSpacePressed(instance)) return
      if (!isBackgroundPointerTarget(event.target, event.currentTarget)) return

      const lockToken = sessionLockState.tryAcquire(instance, 'selectionBox', event.pointerId)
      if (!lockToken) return

      const mode = resolveSelectionMode(event)
      const resolved = toScreenWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )
      lockTokenRef.current = lockToken
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
      setActivePointerId(event.pointerId)
      selectionBoxState.clear(instance)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [instance]
  )

  return {
    handleViewportPointerDown
  }
}
