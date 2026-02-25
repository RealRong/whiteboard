import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { EdgeConnectDraft, Instance, PointerInput } from '@whiteboard/engine'
import { useInstance } from '../../common/hooks'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveConnectPreview,
  resolveSnapTarget
} from '../interaction/connectMath'
import { edgeConnectPreviewStore } from '../interaction/connectPreviewStore'

type ConnectHandleSide = EdgeAnchor['side']

type ActiveConnect = {
  pointerId: number
  button: 0 | 1 | 2
  draft: EdgeConnectDraft
}

const normalizeButton = (button: number): 0 | 1 | 2 => {
  if (button === 1 || button === 2) return button
  return 0
}

const toPointerInput = (
  instance: Instance,
  event: PointerEvent | ReactPointerEvent<HTMLElement>,
  fallbackButton?: 0 | 1 | 2
): PointerInput => {
  const button = fallbackButton ?? normalizeButton(event.button)
  const client: Point = {
    x: event.clientX,
    y: event.clientY
  }
  const screen = instance.query.viewport.clientToScreen(
    event.clientX,
    event.clientY
  )
  return {
    pointerId: event.pointerId,
    button,
    client,
    screen,
    world: instance.query.viewport.screenToWorld(screen),
    modifiers: {
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    }
  }
}

const syncPreview = (
  instance: Instance,
  draft: EdgeConnectDraft
) => {
  const preview = resolveConnectPreview(instance, draft)
  edgeConnectPreviewStore.setActivePreview({
    pointerId: draft.pointerId,
    ...preview
  })
}

const beginFromNode = (
  instance: Instance,
  nodeId: NodeId,
  pointer: PointerInput
): EdgeConnectDraft | undefined => {
  if (instance.state.read('tool') !== 'edge') return undefined
  const entry = instance.query.canvas.nodeRect(nodeId)
  if (!entry) return undefined
  const resolved = instance.query.geometry.anchorFromPoint(
    entry.rect,
    entry.rotation,
    pointer.world
  )
  return {
    pointerId: pointer.pointerId,
    from: {
      nodeId,
      anchor: resolved.anchor
    },
    to: {
      pointWorld: pointer.world
    }
  }
}

const beginFromHandle = (
  nodeId: NodeId,
  side: ConnectHandleSide,
  pointer: PointerInput
): EdgeConnectDraft => ({
  pointerId: pointer.pointerId,
  from: {
    nodeId,
    anchor: {
      side,
      offset: DEFAULT_EDGE_ANCHOR_OFFSET
    }
  }
})

const beginReconnect = (
  instance: Instance,
  edgeId: EdgeId,
  end: 'source' | 'target',
  pointer: PointerInput
): EdgeConnectDraft | undefined => {
  const edge = instance.query.doc.get().edges.find((item) => item.id === edgeId)
  if (!edge) return undefined
  const endpoint = edge[end]
  return {
    pointerId: pointer.pointerId,
    from: {
      nodeId: endpoint.nodeId,
      anchor: endpoint.anchor ?? {
        side: 'right',
        offset: DEFAULT_EDGE_ANCHOR_OFFSET
      }
    },
    reconnect: {
      edgeId,
      end
    }
  }
}

const updateDraft = (
  instance: Instance,
  draft: EdgeConnectDraft,
  pointer: PointerInput
) => {
  if (pointer.pointerId !== draft.pointerId) return false
  const snap = resolveSnapTarget(instance, pointer.world)
  if (snap) {
    draft.to = {
      nodeId: snap.nodeId,
      anchor: snap.anchor,
      pointWorld: snap.pointWorld
    }
  } else {
    draft.to = {
      pointWorld: pointer.world
    }
  }
  return true
}

const commitDraft = (
  instance: Instance,
  draft: EdgeConnectDraft
) => {
  const target = draft.to
  if (!target?.nodeId || !target.anchor) return false

  if (draft.reconnect) {
    void instance.commands.edge.update(
      draft.reconnect.edgeId,
      draft.reconnect.end === 'source'
        ? {
          source: {
            nodeId: target.nodeId,
            anchor: target.anchor
          }
        }
        : {
          target: {
            nodeId: target.nodeId,
            anchor: target.anchor
          }
        }
    )
    return true
  }

  void instance.commands.edge.create({
    source: {
      nodeId: draft.from.nodeId,
      anchor: draft.from.anchor
    },
    target: {
      nodeId: target.nodeId,
      anchor: target.anchor
    },
    type: 'linear'
  })
  return true
}

export const useEdgeConnectInteraction = () => {
  const instance = useInstance()
  const [active, setActive] = useState<ActiveConnect | null>(null)
  const activeRef = useRef<ActiveConnect | null>(null)

  const clearActive = useCallback((pointerId?: number) => {
    edgeConnectPreviewStore.clearActivePreview(pointerId)
    setActive(null)
  }, [])

  const startDraft = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      begin: (pointer: PointerInput) => EdgeConnectDraft | undefined
    ) => {
      if (event.button !== 0) return false
      if (active) return false
      if (edgeConnectPreviewStore.getSnapshot().activePointerId !== undefined) {
        return false
      }

      const pointer = toPointerInput(instance, event)
      const draft = begin(pointer)
      if (!draft) return false

      setActive({
        pointerId: event.pointerId,
        button: pointer.button,
        draft
      })
      syncPreview(instance, draft)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle lifecycle.
      }
      event.preventDefault()
      event.stopPropagation()
      return true
    },
    [active, instance]
  )

  const handleNodeConnectPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      nodeId: NodeId
    ) => startDraft(
      event,
      (pointer) => beginFromNode(instance, nodeId, pointer)
    ),
    [instance, startDraft]
  )

  const handleConnectHandlePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      nodeId: NodeId,
      side: ConnectHandleSide
    ) => startDraft(
      event,
      (pointer) => beginFromHandle(nodeId, side, pointer)
    ),
    [startDraft]
  )

  const handleReconnectPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      edgeId: EdgeId,
      end: 'source' | 'target'
    ) => startDraft(
      event,
      (pointer) => beginReconnect(instance, edgeId, end, pointer)
    ),
    [instance, startDraft]
  )

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      const pointer = toPointerInput(instance, event, active.button)
      if (!updateDraft(instance, active.draft, pointer)) return
      syncPreview(instance, active.draft)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      const pointer = toPointerInput(instance, event, active.button)
      updateDraft(instance, active.draft, pointer)
      void commitDraft(instance, active.draft)
      clearActive(active.pointerId)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      clearActive(active.pointerId)
    }

    const handleBlur = () => {
      clearActive(active.pointerId)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      clearActive(active.pointerId)
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
  }, [active, clearActive, instance])

  useEffect(() => () => {
    if (!activeRef.current) return
    clearActive(activeRef.current.pointerId)
  }, [clearActive])

  return {
    handleNodeConnectPointerDown,
    handleConnectHandlePointerDown,
    handleReconnectPointerDown
  }
}
