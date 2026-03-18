import type { EdgeAnchor, EdgeId, NodeId } from '@whiteboard/core/types'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { EdgeConnectState } from '../../../../types/edge'
import { useInternalInstance, useTool } from '../../../../runtime/hooks'
import { createRafTask } from '../../../../runtime/utils/rafTask'
import type { ViewportPointer } from '../../../../runtime/viewport'
import { CanvasContentIgnoreSelector } from '../../../../canvas/target'
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
  state: EdgeConnectState
}

const NODE_CONNECT_HANDLE_SELECTOR = '[data-input-role="node-edge-handle"]'
const EDGE_ENDPOINT_HANDLE_SELECTOR = '[data-input-role="edge-endpoint-handle"]'
const NODE_SELECTOR = '[data-node-id]'
const CONNECT_IGNORE_SELECTOR = CanvasContentIgnoreSelector

export const useEdgeConnect = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const activeRef = useRef<ActiveConnect | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)
  const hoverEventRef = useRef<PointerEvent | null>(null)

  const readPointer = useCallback((
    event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...instance.viewport.pointer(event)
  }), [instance])

  const beginFromNode = useCallback((
    nodeId: NodeId,
    pointer: ConnectPointer
  ): EdgeConnectState | undefined => {
    const entry = instance.read.index.node.get(nodeId)
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
  ): EdgeConnectState => ({
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
  ): EdgeConnectState | undefined => {
    const edge = instance.read.edge.item.get(edgeId)?.edge
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

  const updateState = useCallback((
    state: EdgeConnectState,
    pointer: ConnectPointer
  ) => {
    if (pointer.pointerId !== state.pointerId) {
      return false
    }

    const snap = resolveSnapTarget(instance, pointer.world)
    if (snap) {
      state.to = {
        nodeId: snap.nodeId,
        anchor: snap.anchor,
        pointWorld: snap.pointWorld
      }
    } else {
      state.to = {
        pointWorld: pointer.world
      }
    }
    return true
  }, [instance])

  const commitState = useCallback((state: EdgeConnectState) => {
    const target = state.to
    if (!target?.nodeId || !target.anchor) {
      return
    }

    if (state.reconnect) {
      instance.commands.edge.update(
        state.reconnect.edgeId,
        state.reconnect.end === 'source'
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

    instance.commands.edge.create({
      source: {
        nodeId: state.from.nodeId,
        anchor: state.from.anchor
      },
      target: {
        nodeId: target.nodeId,
        anchor: target.anchor
      },
      type: 'linear'
    })
  }, [instance])

  const writePreview = useCallback((state: EdgeConnectState) => {
    instance.internals.edge.connection.write({
      activePointerId: state.pointerId,
      ...resolveConnectPreview(instance, state)
    })
  }, [instance])

  const setHoverPreview = useCallback((snap?: { x: number; y: number }) => {
    instance.internals.edge.connection.write(
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
    if (!hoverEvent || activeRef.current || instance.state.tool.get() !== 'edge') {
      return
    }

    const target = resolveSnapTarget(instance, readPointer(hoverEvent).world)
    setHoverPreview(target?.pointWorld)
  }))

  const clear = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    hoverTaskRef.current.cancel()
    hoverEventRef.current = null
    instance.internals.edge.connection.clear()
  }, [instance])

  const cancel = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clear()
  }, [clear])

  const startConnectSession = useCallback((
    event: PointerEvent,
    state: EdgeConnectState
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'edge-connect',
      pointerId: event.pointerId,
      capture: event.target instanceof Element ? event.target : null,
      pan: {
        frame: (pointer) => {
          const active = activeRef.current
          if (!active) {
            return
          }

          if (!updateState(active.state, readPointer({
            pointerId: active.state.pointerId,
            ...pointer
          }))) {
            return
          }

          writePreview(active.state)
        }
      },
      cleanup: clear,
      move: (event, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        if (!updateState(active.state, readPointer(event))) {
          return
        }

        session.pan(event)
        writePreview(active.state)
      },
      up: (_event, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        commitState(active.state)
        session.finish()
      }
    })
    if (!nextSession) return

    activeRef.current = {
      state
    }
    sessionRef.current = nextSession
    writePreview(state)

    event.preventDefault()
    event.stopPropagation()
  }, [clear, commitState, instance, readPointer, updateState, writePreview])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.state.tool.get() !== 'edge') return
      if (!(event.target instanceof Element)) return

      const pointerState = readPointer(event)
      const reconnectElement = event.target.closest(EDGE_ENDPOINT_HANDLE_SELECTOR)
      if (reconnectElement && container.contains(reconnectElement)) {
        const edgeId = reconnectElement.getAttribute('data-edge-id') as EdgeId | null
        const end = reconnectElement.getAttribute('data-edge-end') as 'source' | 'target' | null
        if (!edgeId || !end) {
          return
        }

        const state = beginReconnect(edgeId, end, pointerState)
        if (!state) {
          return
        }

        startConnectSession(event, state)
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

      const state = beginFromNode(nodeId, pointerState)
      if (!state) {
        return
      }

      startConnectSession(event, state)
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

  useEffect(() => () => {
    cancel()
  }, [cancel])
}
