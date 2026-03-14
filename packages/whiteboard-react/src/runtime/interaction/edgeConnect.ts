import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { EdgeConnectDraft } from '../../../types/edge'
import { interactionLock, type InteractionLockToken } from '../../interaction/interactionLock'
import { createRafTask } from '../../utils/rafTask'
import type { InternalWhiteboardInstance } from '../types'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveConnectPreview,
  resolveSnapTarget
} from '../../../features/edge/hooks/connect/math'
import { createSignal } from './signal'
import type {
  ActiveInteractionSessionKind,
  EdgeConnectInteractionRuntime,
  InteractionSession
} from './types'

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
  instance: InternalWhiteboardInstance,
  event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
): ConnectPointer => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return {
    pointerId: event.pointerId,
    world: instance.viewport.screenToWorld(screen)
  }
}

const beginFromNode = (
  instance: InternalWhiteboardInstance,
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
  instance: InternalWhiteboardInstance,
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
  instance: InternalWhiteboardInstance,
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

export const createEdgeConnectInteractionRuntime = (
  getInstance: () => InternalWhiteboardInstance,
  lifecycle: {
    begin: (kind: ActiveInteractionSessionKind) => void
    end: () => void
  }
): EdgeConnectInteractionRuntime => {
  let active: ActiveConnect | null = null
  let hoverEvent: PointerEvent | null = null
  const pointer = createSignal<number | null>(null)

  const setDraftPreview = (draft: EdgeConnectDraft) => {
    const instance = getInstance()
    instance.draft.connection.write({
      activePointerId: draft.pointerId,
      ...resolveConnectPreview(instance, draft)
    })
  }

  const setHoverPreview = (snap?: Point) => {
    getInstance().draft.connection.write(
      snap
        ? {
          showPreviewLine: false,
          snap
        }
        : {
          showPreviewLine: false
        }
    )
  }

  const hoverTask = createRafTask(() => {
    const instance = getInstance()
    if (!hoverEvent || active || instance.state.tool.get() !== 'edge') return
    const target = resolveSnapTarget(instance, readPointer(instance, hoverEvent).world)
    setHoverPreview(target?.pointWorld)
  })

  const cancel = (pointerId?: number) => {
    const instance = getInstance()
    if (pointerId !== undefined && active && active.draft.pointerId !== pointerId) return
    const previous = active
    hoverTask.cancel()
    hoverEvent = null
    active = null
    pointer.set(null)
    instance.draft.connection.clear()
    lifecycle.end()
    if (!previous) return
    interactionLock.release(instance, previous.lockToken)
  }

  const startConnectSession = (event: PointerEvent, draft: EdgeConnectDraft) => {
    const instance = getInstance()
    const lockToken = interactionLock.tryAcquire(instance, 'edgeConnect', event.pointerId)
    if (!lockToken) return

    active = {
      lockToken,
      draft
    }
    pointer.set(event.pointerId)
    lifecycle.begin('edge-connect')
    setDraftPreview(draft)

    try {
      event.target instanceof Element
        ? event.target.setPointerCapture?.(event.pointerId)
        : undefined
    } catch {
      // Ignore capture errors, window listeners still handle session cleanup.
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    pointer,
    cancel,
    handleContainerPointerDown: (event, container) => {
      const instance = getInstance()
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (active) return
      if (instance.state.tool.get() !== 'edge') return
      if (!(event.target instanceof Element)) return

      const pointerState = readPointer(instance, event)
      const reconnectElement = event.target.closest(EDGE_ENDPOINT_HANDLE_SELECTOR)
      if (reconnectElement && container.contains(reconnectElement)) {
        const edgeId = reconnectElement.getAttribute('data-edge-id') as EdgeId | null
        const end = reconnectElement.getAttribute('data-edge-end') as 'source' | 'target' | null
        if (!edgeId || !end) return

        const draft = beginReconnect(instance, edgeId, end, pointerState)
        if (!draft) return
        startConnectSession(event, draft)
        return
      }

      const handleElement = event.target.closest(NODE_CONNECT_HANDLE_SELECTOR)
      if (handleElement && container.contains(handleElement)) {
        const nodeId = handleElement.getAttribute('data-node-id') as NodeId | null
        const side = handleElement.getAttribute('data-handle-side') as ConnectHandleSide | null
        if (!nodeId || !side) return

        startConnectSession(event, beginFromHandle(nodeId, side, pointerState))
        return
      }

      if (event.target.closest(CONNECT_IGNORE_SELECTOR)) return

      const nodeElement = event.target.closest(NODE_SELECTOR)
      if (!nodeElement || !container.contains(nodeElement)) return

      const nodeId = nodeElement.getAttribute('data-node-id') as NodeId | null
      if (!nodeId) return

      const draft = beginFromNode(instance, nodeId, pointerState)
      if (!draft) return
      startConnectSession(event, draft)
    },
    handleContainerPointerMove: (event) => {
      hoverEvent = event
      hoverTask.schedule()
    },
    handleContainerPointerLeave: () => {
      hoverTask.cancel()
      hoverEvent = null
      setHoverPreview(undefined)
    },
    onWindowPointerMove: (event) => {
      const instance = getInstance()
      if (!active) return
      if (!updateDraft(instance, active.draft, readPointer(instance, event))) return
      setDraftPreview(active.draft)
    },
    onWindowPointerUp: (event) => {
      const instance = getInstance()
      if (!active || active.draft.pointerId !== event.pointerId) return
      commitDraft(instance, active.draft)
      cancel(active.draft.pointerId)
    },
    onWindowPointerCancel: (event) => {
      if (!active || active.draft.pointerId !== event.pointerId) return
      cancel(active.draft.pointerId)
    },
    onWindowBlur: () => {
      cancel()
    },
    onWindowKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancel()
    }
  }
}
