import type { EdgeAnchor, EdgeId, NodeId } from '@whiteboard/core/types'
import type { EdgeConnectDraft } from '../../../../types/edge'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useInternalInstance as useInstance, useTool, useView } from '../../../../runtime/hooks'
import { interactionLock } from '../../../../runtime/interaction/interactionLock'
import { createSignal } from '../../../../runtime/interaction/signal'
import { useWindowPointerSession } from '../../../../runtime/interaction/useWindowPointerSession'
import { createRafTask } from '../../../../runtime/utils/rafTask'
import type { ViewportPointer } from '../../../../runtime/viewport'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveConnectPreview,
  resolveSnapTarget
} from './math'

type ConnectHandleSide = EdgeAnchor['side']

type ConnectPointer = ViewportPointer & {
  pointerId: number
}

type ActiveConnect = {
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

export const useEdgeConnect = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInstance()
  const tool = useTool()
  const activeRef = useRef<ActiveConnect | null>(null)
  const tokenRef = useRef<ReturnType<typeof instance.interaction.tryStart> | null>(null)
  const lockTokenRef = useRef<ReturnType<typeof interactionLock.tryAcquire> | null>(null)
  const hoverEventRef = useRef<PointerEvent | null>(null)
  const pointerRef = useRef(createSignal<number | null>(null))

  const readPointer = useCallback((
    event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...instance.viewport.pointer(event)
  }), [instance])

  const beginFromNode = useCallback((
    nodeId: NodeId,
    pointer: ConnectPointer
  ): EdgeConnectDraft | undefined => {
    const entry = instance.read.index.node.byId(nodeId)
    if (!entry) {
      return undefined
    }

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
  }, [instance])

  const beginFromHandle = useCallback((
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
  }), [])

  const beginReconnect = useCallback((
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: ConnectPointer
  ): EdgeConnectDraft | undefined => {
    const edge = instance.read.edge.get(edgeId)?.edge
    if (!edge) {
      return undefined
    }

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
  }, [instance])

  const updateDraft = useCallback((
    draft: EdgeConnectDraft,
    pointer: ConnectPointer
  ) => {
    if (pointer.pointerId !== draft.pointerId) {
      return false
    }

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
  }, [instance])

  const commitDraft = useCallback((draft: EdgeConnectDraft) => {
    const target = draft.to
    if (!target?.nodeId || !target.anchor) {
      return
    }

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
      return
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
  }, [instance])

  const setDraftPreview = useCallback((draft: EdgeConnectDraft) => {
    instance.draft.connection.write({
      activePointerId: draft.pointerId,
      ...resolveConnectPreview(instance, draft)
    })
  }, [instance])

  const setHoverPreview = useCallback((snap?: { x: number; y: number }) => {
    instance.draft.connection.write(
      snap
        ? {
          showPreviewLine: false,
          snap
        }
        : {
          showPreviewLine: false
        }
    )
  }, [instance])

  const hoverTaskRef = useRef(createRafTask(() => {
    const hoverEvent = hoverEventRef.current
    if (!hoverEvent || activeRef.current || instance.view.tool.get() !== 'edge') {
      return
    }

    const target = resolveSnapTarget(instance, readPointer(hoverEvent).world)
    setHoverPreview(target?.pointWorld)
  }))

  const cancel = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.draft.pointerId !== pointerId) {
      return
    }

    const token = tokenRef.current
    const lockToken = lockTokenRef.current
    activeRef.current = null
    tokenRef.current = null
    lockTokenRef.current = null
    hoverTaskRef.current.cancel()
    hoverEventRef.current = null
    pointerRef.current.set(null)
    instance.draft.connection.clear()

    if (lockToken) {
      interactionLock.release(instance, lockToken)
    }

    if (token) {
      instance.interaction.finish(token)
    }
  }, [instance])

  const startConnectSession = useCallback((
    event: PointerEvent,
    draft: EdgeConnectDraft
  ) => {
    const lockToken = interactionLock.tryAcquire(instance, 'edgeConnect', event.pointerId)
    if (!lockToken) {
      return
    }

    const token = instance.interaction.tryStart('edge-connect', () => cancel(event.pointerId))
    if (!token) {
      interactionLock.release(instance, lockToken)
      return
    }

    activeRef.current = {
      draft
    }
    tokenRef.current = token
    lockTokenRef.current = lockToken
    pointerRef.current.set(event.pointerId)
    setDraftPreview(draft)

    try {
      if (event.target instanceof Element) {
        event.target.setPointerCapture?.(event.pointerId)
      }
    } catch {
      // Ignore capture errors, window listeners still handle session cleanup.
    }

    event.preventDefault()
    event.stopPropagation()
  }, [cancel, instance, setDraftPreview])

  const pointerId = useView(pointerRef.current)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.view.tool.get() !== 'edge') return
      if (!(event.target instanceof Element)) return

      const pointerState = readPointer(event)
      const reconnectElement = event.target.closest(EDGE_ENDPOINT_HANDLE_SELECTOR)
      if (reconnectElement && container.contains(reconnectElement)) {
        const edgeId = reconnectElement.getAttribute('data-edge-id') as EdgeId | null
        const end = reconnectElement.getAttribute('data-edge-end') as 'source' | 'target' | null
        if (!edgeId || !end) {
          return
        }

        const draft = beginReconnect(edgeId, end, pointerState)
        if (!draft) {
          return
        }

        startConnectSession(event, draft)
        return
      }

      const handleElement = event.target.closest(NODE_CONNECT_HANDLE_SELECTOR)
      if (handleElement && container.contains(handleElement)) {
        const nodeId = handleElement.getAttribute('data-node-id') as NodeId | null
        const side = handleElement.getAttribute('data-handle-side') as ConnectHandleSide | null
        if (!nodeId || !side) {
          return
        }

        startConnectSession(event, beginFromHandle(nodeId, side, pointerState))
        return
      }

      if (event.target.closest(CONNECT_IGNORE_SELECTOR)) return

      const nodeElement = event.target.closest(NODE_SELECTOR)
      if (!nodeElement || !container.contains(nodeElement)) {
        return
      }

      const nodeId = nodeElement.getAttribute('data-node-id') as NodeId | null
      if (!nodeId) {
        return
      }

      const draft = beginFromNode(nodeId, pointerState)
      if (!draft) {
        return
      }

      startConnectSession(event, draft)
    }

    const handlePointerMove = (event: PointerEvent) => {
      hoverEventRef.current = event
      hoverTaskRef.current.schedule()
    }

    const handlePointerLeave = () => {
      hoverTaskRef.current.cancel()
      hoverEventRef.current = null
      setHoverPreview(undefined)
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      hoverTaskRef.current.cancel()
      hoverEventRef.current = null
      setHoverPreview(undefined)
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [
    beginFromHandle,
    beginFromNode,
    beginReconnect,
    containerRef,
    instance,
    readPointer,
    setHoverPreview,
    startConnectSession
  ])

  useEffect(() => {
    if (tool !== 'edge') {
      cancel()
    }
  }, [cancel, tool])

  useWindowPointerSession({
    pointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active) {
        return
      }

      if (!updateDraft(active.draft, readPointer(event))) {
        return
      }

      setDraftPreview(active.draft)
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || active.draft.pointerId !== event.pointerId) {
        return
      }

      commitDraft(active.draft)
      cancel(active.draft.pointerId)
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || active.draft.pointerId !== event.pointerId) {
        return
      }

      cancel(active.draft.pointerId)
    },
    onBlur: () => {
      cancel()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') {
        return
      }

      cancel()
    }
  })

  useEffect(() => () => {
    cancel()
  }, [cancel])
}
