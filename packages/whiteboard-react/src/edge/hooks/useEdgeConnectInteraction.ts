import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { EdgeConnectDraft, PointerInput } from '../../types/edge'
import type { InternalWhiteboardInstance } from '../../common/instance'
import { useInternalInstance as useInstance } from '../../common/hooks'
import { sessionLockState, type SessionLockToken } from '../../common/interaction/sessionLockState'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveConnectPreview,
  resolveSnapTarget
} from '../interaction/connectMath'
import { edgeConnectPreviewState } from '../interaction/connectPreviewState'

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
  instance: InternalWhiteboardInstance,
  event: PointerEvent | ReactPointerEvent<HTMLElement>,
  fallbackButton?: 0 | 1 | 2
): PointerInput => {
  const button = fallbackButton ?? normalizeButton(event.button)
  const client: Point = {
    x: event.clientX,
    y: event.clientY
  }
  const screen = instance.viewport.clientToScreen(
    event.clientX,
    event.clientY
  )
  return {
    pointerId: event.pointerId,
    button,
    client,
    screen,
    world: instance.viewport.screenToWorld(screen),
    modifiers: {
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    }
  }
}

const syncPreview = (
  instance: InternalWhiteboardInstance,
  draft: EdgeConnectDraft
) => {
  const preview = resolveConnectPreview(instance, draft)
  edgeConnectPreviewState.setActivePreview(instance, {
    pointerId: draft.pointerId,
    ...preview
  })
}

const beginFromNode = (
  instance: InternalWhiteboardInstance,
  nodeId: NodeId,
  pointer: PointerInput
): EdgeConnectDraft | undefined => {
  if (instance.state.read('tool') !== 'edge') return undefined
  const entry = instance.read.index.node.byId(nodeId)
  if (!entry) return undefined
  const resolved = resolveAnchorFromPoint(
    instance,
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
  instance: InternalWhiteboardInstance,
  edgeId: EdgeId,
  end: 'source' | 'target',
  pointer: PointerInput
): EdgeConnectDraft | undefined => {
  const edge = instance.read.edge.byId.get(edgeId)?.edge
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
  instance: InternalWhiteboardInstance,
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
  instance: InternalWhiteboardInstance,
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
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveConnect | null>(null)
  const lockTokenRef = useRef<SessionLockToken | null>(null)

  const clearActive = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.pointerId !== pointerId) {
      return
    }
    edgeConnectPreviewState.clearActivePreview(instance, pointerId)
    activeRef.current = null
    setActivePointerId(null)
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

  const startDraft = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      begin: (pointer: PointerInput) => EdgeConnectDraft | undefined
    ) => {
      if (event.button !== 0) return false
      if (activeRef.current) return false
      if (edgeConnectPreviewState.getSnapshot(instance).activePointerId !== undefined) {
        return false
      }

      const pointer = toPointerInput(instance, event)
      const draft = begin(pointer)
      if (!draft) return false
      const lockToken = sessionLockState.tryAcquire(instance, 'edgeConnect', event.pointerId)
      if (!lockToken) return false
      const nextActive: ActiveConnect = {
        pointerId: event.pointerId,
        button: pointer.button,
        draft
      }

      lockTokenRef.current = lockToken
      activeRef.current = nextActive
      setActivePointerId(event.pointerId)
      syncPreview(instance, draft)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }
      event.preventDefault()
      event.stopPropagation()
      return true
    },
    [instance]
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

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      const pointer = toPointerInput(instance, event, active.button)
      if (!updateDraft(instance, active.draft, pointer)) return
      syncPreview(instance, active.draft)
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      const pointer = toPointerInput(instance, event, active.button)
      updateDraft(instance, active.draft, pointer)
      void commitDraft(instance, active.draft)
      clearActive(active.pointerId)
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      clearActive(active.pointerId)
    },
    onBlur: () => {
      clearActive()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clearActive()
    }
  })

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
