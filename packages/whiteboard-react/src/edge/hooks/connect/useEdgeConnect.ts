import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { EdgeConnectDraft } from '../../../types/edge'
import type { RefObject } from 'react'
import { useInternalInstance as useInstance, useTool } from '../../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../../common/interaction/useWindowPointerSession'
import { createRafTask } from '../../../common/utils/rafTask'
import type { ConnectionWriter } from '../../../transient'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveConnectPreview,
  resolveSnapTarget
} from './math'

type ConnectHandleSide = EdgeAnchor['side']

type ConnectPointer = {
  pointerId: number
  world: Point
}

type ActiveConnect = {
  lockToken: InteractionLockToken
  draft: EdgeConnectDraft
}

const NODE_CONNECT_HANDLE_SELECTOR = '[data-input-role="node-edge-handle"]'
const EDGE_ENDPOINT_HANDLE_SELECTOR = '[data-input-role="edge-endpoint-handle"]'
const NODE_SELECTOR = '[data-node-id]'
const CONNECT_IGNORE_SELECTOR = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  '[data-input-role]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

const readPointer = (
  instance: ReturnType<typeof useInstance>,
  event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
): ConnectPointer => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return {
    pointerId: event.pointerId,
    world: instance.viewport.screenToWorld(screen)
  }
}

const beginFromNode = (
  instance: ReturnType<typeof useInstance>,
  nodeId: NodeId,
  pointer: ConnectPointer
): EdgeConnectDraft | undefined => {
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
  pointer: ConnectPointer
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
  instance: ReturnType<typeof useInstance>,
  edgeId: EdgeId,
  end: 'source' | 'target',
  pointer: ConnectPointer
): EdgeConnectDraft | undefined => {
  const edge = instance.read.edge.get(edgeId)?.edge
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
  instance: ReturnType<typeof useInstance>,
  draft: EdgeConnectDraft,
  pointer: ConnectPointer
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
  instance: ReturnType<typeof useInstance>,
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

export const useEdgeConnect = ({
  containerRef,
  connection
}: {
  containerRef: RefObject<HTMLDivElement | null>
  connection: ConnectionWriter
}) => {
  const instance = useInstance()
  const tool = useTool()
  const hoverEventRef = useRef<PointerEvent | null>(null)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveConnect | null>(null)

  const setDraftPreview = useCallback((draft: EdgeConnectDraft) => {
    connection.write({
      activePointerId: draft.pointerId,
      ...resolveConnectPreview(instance, draft)
    })
  }, [connection, instance])

  const setHoverPreview = useCallback((snap?: Point) => {
    connection.write(
      snap
        ? {
          showPreviewLine: false,
          snap
        }
        : {
          showPreviewLine: false
        }
    )
  }, [connection])

  const hoverTask = useMemo(
    () => createRafTask(() => {
      const event = hoverEventRef.current
      if (!event || activeRef.current || instance.state.tool() !== 'edge') return
      const pointer = readPointer(instance, event)
      const target = resolveSnapTarget(instance, pointer.world)
      setHoverPreview(target?.pointWorld)
    }),
    [instance, setHoverPreview]
  )

  const cancelConnectSession = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.draft.pointerId !== pointerId) return
    hoverTask.cancel()
    hoverEventRef.current = null
    activeRef.current = null
    setActivePointerId(null)
    connection.clear()
    if (!active) return
    interactionLock.release(instance, active.lockToken)
  }, [connection, hoverTask, instance])

  const startConnectSession = useCallback((event: PointerEvent, draft: EdgeConnectDraft) => {
    const lockToken = interactionLock.tryAcquire(instance, 'edgeConnect', event.pointerId)
    if (!lockToken) return

    activeRef.current = {
      lockToken,
      draft
    }
    setActivePointerId(event.pointerId)
    setDraftPreview(draft)

    try {
      event.target instanceof Element
        ? (event.target as Element).setPointerCapture?.(event.pointerId)
        : undefined
    } catch {
      // Ignore capture errors, window listeners still handle session cleanup.
    }
    event.preventDefault()
    event.stopPropagation()
  }, [instance, setDraftPreview])

  const handleContainerPointerDown = useCallback((
    event: PointerEvent,
    container: HTMLDivElement
  ) => {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (activeRef.current) return
    if (instance.state.tool() !== 'edge') return
    if (!(event.target instanceof Element)) return

    const pointer = readPointer(instance, event)
    const reconnectElement = event.target.closest(EDGE_ENDPOINT_HANDLE_SELECTOR)
    if (reconnectElement && container.contains(reconnectElement)) {
      const edgeId = reconnectElement.getAttribute('data-edge-id') as EdgeId | null
      const end = reconnectElement.getAttribute('data-edge-end') as 'source' | 'target' | null
      if (!edgeId || !end) return

      const draft = beginReconnect(instance, edgeId, end, pointer)
      if (!draft) return
      startConnectSession(event, draft)
      return
    }

    const handleElement = event.target.closest(NODE_CONNECT_HANDLE_SELECTOR)
    if (handleElement && container.contains(handleElement)) {
      const nodeId = handleElement.getAttribute('data-node-id') as NodeId | null
      const side = handleElement.getAttribute('data-handle-side') as ConnectHandleSide | null
      if (!nodeId || !side) return

      startConnectSession(event, beginFromHandle(nodeId, side, pointer))
      return
    }

    if (event.target.closest(CONNECT_IGNORE_SELECTOR)) return

    const nodeElement = event.target.closest(NODE_SELECTOR)
    if (!nodeElement || !container.contains(nodeElement)) return

    const nodeId = nodeElement.getAttribute('data-node-id') as NodeId | null
    if (!nodeId) return

    const draft = beginFromNode(instance, nodeId, pointer)
    if (!draft) return
    startConnectSession(event, draft)
  }, [instance, startConnectSession])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handlePointerDown = (event: PointerEvent) => {
      handleContainerPointerDown(event, container)
    }
    const handlePointerMove = (event: PointerEvent) => {
      hoverEventRef.current = event
      hoverTask.schedule()
    }
    const handlePointerLeave = () => {
      hoverTask.cancel()
      hoverEventRef.current = null
      setHoverPreview(undefined)
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      hoverTask.cancel()
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [containerRef, handleContainerPointerDown, hoverTask, setHoverPreview])

  useEffect(() => {
    if (tool !== 'edge') {
      cancelConnectSession()
    }
  }, [cancelConnectSession, tool])

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active) return
      if (!updateDraft(instance, active.draft, readPointer(instance, event))) return
      setDraftPreview(active.draft)
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || active.draft.pointerId !== event.pointerId) return
      commitDraft(instance, active.draft)
      cancelConnectSession(active.draft.pointerId)
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || active.draft.pointerId !== event.pointerId) return
      cancelConnectSession(active.draft.pointerId)
    },
    onBlur: () => {
      cancelConnectSession()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancelConnectSession()
    }
  })

  return {
    cancelConnectSession
  }
}
