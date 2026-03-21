import { getAnchorPoint } from '@whiteboard/core/geometry'
import type {
  EdgeAnchor,
  EdgeId,
  EdgePatch,
  EdgeType,
  NodeId
} from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import { CanvasContentIgnoreSelector } from '../../../canvas/target'
import {
  hasEdge,
  leave
} from '../../../runtime/container'
import { useInternalInstance, useTool } from '../../../runtime/hooks'
import { readEdgeType } from '../../../runtime/tool'
import { createRafTask } from '../../../runtime/utils/rafTask'
import type { EdgeConnectState, EdgeDraftEnd } from '../../../types/edge'
import {
  ConnectHandleSide,
  type ConnectPointer,
  type PointerSourceEvent,
  readCaptureTarget,
  toEdgeEnd,
  toSessionPatch
} from './inputShared'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveConnectPreview,
  resolveSnapTarget
} from './connect/math'

type ActiveConnect = {
  state: EdgeConnectState
}

const NODE_CONNECT_HANDLE_SELECTOR = '[data-input-role="node-edge-handle"]'
const NODE_SELECTOR = '[data-node-id]'
const CONNECT_IGNORE_SELECTOR = CanvasContentIgnoreSelector

export const useEdgeConnectInput = ({
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
    event: Pick<PointerSourceEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...instance.viewport.pointer(event)
  }), [instance])

  const writeEdgePreview = useCallback((
    edgeId: EdgeId,
    patch: EdgePatch,
    activePathIndex?: number
  ) => {
    instance.internals.edge.path.write({
      patches: [toSessionPatch(edgeId, patch, activePathIndex)]
    })
  }, [instance])

  const clearEdgePreview = useCallback(() => {
    instance.internals.edge.path.clear()
  }, [instance])

  const beginFromPoint = useCallback((
    pointer: ConnectPointer,
    edgeType: EdgeType
  ): EdgeConnectState => ({
    kind: 'create',
    pointerId: pointer.pointerId,
    edgeType,
    from: {
      kind: 'point',
      point: pointer.world
    },
    to: {
      kind: 'point',
      point: pointer.world
    }
  }), [])

  const beginFromNode = useCallback((
    nodeId: NodeId,
    pointer: ConnectPointer,
    edgeType: EdgeType
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
      kind: 'create',
      pointerId: pointer.pointerId,
      edgeType,
      from: {
        kind: 'node',
        nodeId,
        anchor: resolved.anchor,
        point: resolved.point
      },
      to: {
        kind: 'point',
        point: pointer.world
      }
    }
  }, [instance])

  const beginFromHandle = useCallback((
    nodeId: NodeId,
    side: ConnectHandleSide,
    pointer: ConnectPointer,
    edgeType: EdgeType
  ): EdgeConnectState | undefined => {
    const entry = instance.read.index.node.get(nodeId)
    if (!entry) {
      return undefined
    }

    const anchor: EdgeAnchor = {
      side,
      offset: DEFAULT_EDGE_ANCHOR_OFFSET
    }

    return {
      kind: 'create',
      pointerId: pointer.pointerId,
      edgeType,
      from: {
        kind: 'node',
        nodeId,
        anchor,
        point: getAnchorPoint(entry.rect, anchor, entry.rotation)
      },
      to: {
        kind: 'point',
        point: pointer.world
      }
    }
  }, [instance])

  const beginReconnect = useCallback((
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: ConnectPointer
  ): EdgeConnectState | undefined => {
    const item = instance.read.edge.item.get(edgeId)
    if (!item) {
      return undefined
    }

    const edgeEnd = item.edge[end]
    const resolvedEnd = item.ends[end]
    const from: EdgeDraftEnd =
      edgeEnd.kind === 'node'
        ? {
            kind: 'node',
            nodeId: edgeEnd.nodeId,
            anchor: edgeEnd.anchor ?? {
              side: resolvedEnd.anchor?.side ?? 'right',
              offset: resolvedEnd.anchor?.offset ?? DEFAULT_EDGE_ANCHOR_OFFSET
            },
            point: resolvedEnd.point
          }
        : {
            kind: 'point',
            point: resolvedEnd.point
          }

    return {
      kind: 'reconnect',
      pointerId: pointer.pointerId,
      edgeId,
      end,
      from
    }
  }, [instance])

  const updateConnectState = useCallback((
    state: EdgeConnectState,
    pointer: ConnectPointer
  ) => {
    if (pointer.pointerId !== state.pointerId) {
      return false
    }

    const snap = resolveSnapTarget(instance, pointer.world)
    state.to = snap
      ? {
          kind: 'node',
          nodeId: snap.nodeId,
          anchor: snap.anchor,
          point: snap.pointWorld
        }
      : {
          kind: 'point',
          point: pointer.world
        }
    return true
  }, [instance])

  const commitConnectState = useCallback((state: EdgeConnectState) => {
    const target = state.to
    if (!target) {
      return
    }

    if (state.kind === 'reconnect') {
      instance.commands.edge.update(
        state.edgeId,
        state.end === 'source'
          ? { source: toEdgeEnd(target) }
          : { target: toEdgeEnd(target) }
      )
      return
    }

    instance.commands.edge.create({
      source: toEdgeEnd(state.from),
      target: toEdgeEnd(target),
      type: state.edgeType
    })
  }, [instance])

  const writeConnectPreview = useCallback((state: EdgeConnectState) => {
    instance.internals.edge.connection.write({
      activePointerId: state.pointerId,
      ...resolveConnectPreview(instance, state)
    })

    if (state.kind !== 'reconnect' || !state.to) {
      clearEdgePreview()
      return
    }

    writeEdgePreview(
      state.edgeId,
      state.end === 'source'
        ? { source: toEdgeEnd(state.to) }
        : { target: toEdgeEnd(state.to) }
    )
  }, [clearEdgePreview, instance, writeEdgePreview])

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
    if (!hoverEvent || activeRef.current || !instance.read.tool.is('edge')) {
      return
    }

    const target = resolveSnapTarget(instance, readPointer(hoverEvent).world)
    setHoverPreview(target?.pointWorld)
  }))

  const clearConnect = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    hoverTaskRef.current.cancel()
    hoverEventRef.current = null
    instance.internals.edge.connection.clear()
    clearEdgePreview()
  }, [clearEdgePreview, instance])

  const cancelConnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clearConnect()
  }, [clearConnect])

  const startConnectSession = useCallback((
    event: PointerSourceEvent,
    state: EdgeConnectState
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'edge-connect',
      pointerId: event.pointerId,
      capture: readCaptureTarget(event),
      pan: {
        frame: (pointer) => {
          const active = activeRef.current
          if (!active) {
            return
          }

          if (!updateConnectState(active.state, readPointer({
            pointerId: active.state.pointerId,
            ...pointer
          }))) {
            return
          }

          writeConnectPreview(active.state)
        }
      },
      cleanup: clearConnect,
      move: (moveEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        if (!updateConnectState(active.state, readPointer(moveEvent))) {
          return
        }

        session.pan(moveEvent)
        writeConnectPreview(active.state)
      },
      up: (_upEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        commitConnectState(active.state)
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    activeRef.current = {
      state
    }
    sessionRef.current = nextSession
    writeConnectPreview(state)

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clearConnect, commitConnectState, instance, readPointer, updateConnectState, writeConnectPreview])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (activeRef.current) return
      if (!instance.read.tool.is('edge')) return
      if (!(event.target instanceof Element)) return

      const edgeType = tool.type === 'edge'
        ? readEdgeType(tool.preset)
        : undefined
      if (!edgeType) {
        return
      }

      const pointerState = readPointer(event)
      const handleElement = event.target.closest(NODE_CONNECT_HANDLE_SELECTOR)
      if (handleElement && container.contains(handleElement)) {
        const nodeId = handleElement.getAttribute('data-node-id') as NodeId | null
        const side = handleElement.getAttribute('data-handle-side') as ConnectHandleSide | null
        if (!nodeId || !side) {
          return
        }

        const state = beginFromHandle(nodeId, side, pointerState, edgeType)
        if (!state) {
          return
        }

        startConnectSession(event, state)
        return
      }

      if (event.target.closest(CONNECT_IGNORE_SELECTOR)) return

      const nodeElement = event.target.closest(NODE_SELECTOR)
      if (!nodeElement || !container.contains(nodeElement)) {
        startConnectSession(event, beginFromPoint(pointerState, edgeType))
        return
      }

      const nodeId = nodeElement.getAttribute('data-node-id') as NodeId | null
      if (!nodeId) {
        return
      }

      const state = beginFromNode(nodeId, pointerState, edgeType)
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
    beginFromPoint,
    containerRef,
    instance,
    readPointer,
    setHoverPreview,
    startConnectSession,
    tool
  ])

  useEffect(() => {
    if (tool.type !== 'edge' && activeRef.current?.state.kind === 'create') {
      cancelConnect()
    }
  }, [cancelConnect, tool])

  useEffect(() => () => {
    cancelConnect()
  }, [cancelConnect])

  return {
    handleEndpointPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) {
        return
      }

      if (activeRef.current) {
        return
      }

      const edgeId = event.currentTarget.getAttribute('data-edge-id') as EdgeId | null
      const end = event.currentTarget.getAttribute('data-edge-end') as 'source' | 'target' | null
      if (!edgeId || !end) {
        return
      }

      const entry = instance.read.edge.item.get(edgeId)
      if (!entry) {
        return
      }

      if (!hasEdge(instance.state.container.get(), entry.edge)) {
        leave(instance)
      }

      instance.commands.selection.selectEdge(edgeId)

      const state = beginReconnect(edgeId, end, readPointer(event))
      if (!state) {
        return
      }

      startConnectSession(event, state)
    }
  }
}
