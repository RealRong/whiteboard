import { moveEdge } from '@whiteboard/core/edge'
import { getAnchorPoint, isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeItem } from '@whiteboard/core/read'
import type {
  EdgeAnchor,
  EdgeEnd,
  EdgeId,
  EdgePatch,
  EdgeType,
  NodeId,
  Point
} from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
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
import type { ViewportPointer } from '../../../runtime/viewport'
import type { EdgeConnectState, EdgeDraftEnd } from '../../../types/edge'
import type { SelectedEdgePathPointView } from './useEdgeView'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveConnectPreview,
  resolveSnapTarget
} from './connect/math'

type ConnectHandleSide = EdgeAnchor['side']

type ConnectPointer = ViewportPointer & {
  pointerId: number
}

type PointerSourceEvent = {
  pointerId: number
  clientX: number
  clientY: number
  button: number
  detail: number
  shiftKey: boolean
  target: EventTarget | null
  currentTarget: EventTarget | null
  preventDefault: () => void
  stopPropagation: () => void
}

type ActiveConnect = {
  state: EdgeConnectState
}

type ActivePath = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

type ActiveDrag = {
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
  edge: EdgeItem['edge']
}

const NODE_CONNECT_HANDLE_SELECTOR = '[data-input-role="node-edge-handle"]'
const NODE_SELECTOR = '[data-node-id]'
const CONNECT_IGNORE_SELECTOR = CanvasContentIgnoreSelector

const toEdgeEnd = (
  value: EdgeDraftEnd
): EdgeEnd => (
  value.kind === 'node'
    ? {
        kind: 'node',
        nodeId: value.nodeId,
        anchor: value.anchor
      }
    : {
        kind: 'point',
        point: value.point
      }
)

const toPathPatch = (
  points: readonly Point[]
): EdgePatch => ({
  path: {
    points: [...points]
  }
})

const toSessionPatch = (
  edgeId: EdgeId,
  patch: EdgePatch,
  activePathIndex?: number
) => ({
  id: edgeId,
  source: patch.source,
  target: patch.target,
  pathPoints: patch.path?.points,
  activePathIndex
})

const canMoveEdge = (
  edge: EdgeItem['edge']
) => (
  edge.source.kind === 'point'
  && edge.target.kind === 'point'
)

const readCaptureTarget = (
  event: PointerSourceEvent
): Element | null => (
  event.currentTarget instanceof Element
    ? event.currentTarget
    : event.target instanceof Element
      ? event.target
      : null
)

export const useEdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const tool = useTool()

  const connectActiveRef = useRef<ActiveConnect | null>(null)
  const connectSessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)
  const hoverEventRef = useRef<PointerEvent | null>(null)

  const pathActiveRef = useRef<ActivePath | null>(null)
  const pathSessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const dragActiveRef = useRef<ActiveDrag | null>(null)
  const dragSessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

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
          ? {
              source: toEdgeEnd(target)
            }
          : {
              target: toEdgeEnd(target)
            }
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
        ? {
            source: toEdgeEnd(state.to)
          }
        : {
            target: toEdgeEnd(state.to)
          }
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
    if (!hoverEvent || connectActiveRef.current || !instance.read.tool.is('edge')) {
      return
    }

    const target = resolveSnapTarget(instance, readPointer(hoverEvent).world)
    setHoverPreview(target?.pointWorld)
  }))

  const clearConnect = useCallback(() => {
    connectActiveRef.current = null
    connectSessionRef.current = null
    hoverTaskRef.current.cancel()
    hoverEventRef.current = null
    instance.internals.edge.connection.clear()
    clearEdgePreview()
  }, [clearEdgePreview, instance])

  const cancelConnect = useCallback(() => {
    if (connectSessionRef.current) {
      connectSessionRef.current.cancel()
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
          const active = connectActiveRef.current
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
        const active = connectActiveRef.current
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
        const active = connectActiveRef.current
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

    connectActiveRef.current = {
      state
    }
    connectSessionRef.current = nextSession
    writeConnectPreview(state)

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clearConnect, commitConnectState, instance, readPointer, updateConnectState, writeConnectPreview])

  const readPathEntry = useCallback((edgeId: EdgeId) => (
    instance.read.edge.item.get(edgeId)
  ), [instance])

  const clearPath = useCallback(() => {
    pathActiveRef.current = null
    pathSessionRef.current = null
    clearEdgePreview()
  }, [clearEdgePreview])

  const cancelPath = useCallback(() => {
    if (pathSessionRef.current) {
      pathSessionRef.current.cancel()
      return
    }
    clearPath()
  }, [clearPath])

  const updatePathPreview = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = pathActiveRef.current
    if (!active) {
      return
    }

    const entry = readPathEntry(active.edgeId)
    if (!entry) {
      cancelPath()
      return
    }

    const points = entry.edge.path?.points ?? []
    if (active.index < 0 || active.index >= points.length) {
      cancelPath()
      return
    }

    const { world } = instance.viewport.pointer(input)
    const point = {
      x: active.origin.x + (world.x - active.start.x),
      y: active.origin.y + (world.y - active.start.y)
    }
    if (isPointEqual(point, active.point)) {
      return
    }

    active.point = point
    writeEdgePreview(
      active.edgeId,
      toPathPatch(points.map((entryPoint, pointIndex) => (
        pointIndex === active.index ? point : entryPoint
      ))),
      active.index
    )
  }, [cancelPath, instance, readPathEntry, writeEdgePreview])

  const startPathDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number,
    origin: Point
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'edge-path',
      pointerId: event.pointerId,
      capture: event.currentTarget,
      pan: {
        frame: (pointer) => {
          updatePathPreview(pointer)
        }
      },
      cleanup: clearPath,
      move: (moveEvent, session) => {
        if (!pathActiveRef.current) {
          return
        }

        session.pan(moveEvent)
        updatePathPreview(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = pathActiveRef.current
        if (!active) {
          return
        }

        if (
          readPathEntry(active.edgeId)
          && !isPointEqual(active.point, active.origin)
        ) {
          instance.commands.edge.path.move(active.edgeId, active.index, active.point)
        }
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    pathActiveRef.current = {
      edgeId,
      index,
      pointerId: event.pointerId,
      start: instance.viewport.pointer(event).world,
      origin,
      point: origin
    }
    pathSessionRef.current = nextSession
    const points = readPathEntry(edgeId)?.edge.path?.points ?? []
    writeEdgePreview(edgeId, toPathPatch(points), index)
    return true
  }, [clearPath, instance, readPathEntry, updatePathPreview, writeEdgePreview])

  const clearDrag = useCallback(() => {
    dragActiveRef.current = null
    dragSessionRef.current = null
    clearEdgePreview()
  }, [clearEdgePreview])

  const cancelDrag = useCallback(() => {
    if (dragSessionRef.current) {
      dragSessionRef.current.cancel()
      return
    }
    clearDrag()
  }, [clearDrag])

  const updateDragPreview = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = dragActiveRef.current
    if (!active) {
      return
    }

    const { world } = instance.viewport.pointer(input)
    const delta = {
      x: world.x - active.start.x,
      y: world.y - active.start.y
    }
    if (isPointEqual(delta, active.delta)) {
      return
    }

    active.delta = delta

    const patch = moveEdge(active.edge, delta)
    if (!patch) {
      clearEdgePreview()
      return
    }

    writeEdgePreview(active.edgeId, patch)
  }, [clearEdgePreview, instance, writeEdgePreview])

  const startEdgeDrag = useCallback((
    event: PointerSourceEvent,
    edgeId: EdgeId,
    edge: EdgeItem['edge']
  ) => {
    if (!canMoveEdge(edge)) {
      return false
    }

    const nextSession = instance.interaction.start({
      mode: 'edge-drag',
      pointerId: event.pointerId,
      capture: readCaptureTarget(event),
      pan: {
        frame: (pointer) => {
          updateDragPreview(pointer)
        }
      },
      cleanup: clearDrag,
      move: (moveEvent, session) => {
        if (!dragActiveRef.current) {
          return
        }

        session.pan(moveEvent)
        updateDragPreview(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = dragActiveRef.current
        if (!active) {
          return
        }

        if (!isPointEqual(active.delta, { x: 0, y: 0 })) {
          instance.commands.edge.move(active.edgeId, active.delta)
          instance.commands.selection.clear()
        }
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    dragActiveRef.current = {
      edgeId,
      pointerId: event.pointerId,
      start: instance.viewport.pointer(event).world,
      delta: { x: 0, y: 0 },
      edge
    }
    dragSessionRef.current = nextSession
    return true
  }, [clearDrag, instance, updateDragPreview])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (connectActiveRef.current) return
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
    if (tool.type !== 'edge' && connectActiveRef.current?.state.kind === 'create') {
      cancelConnect()
    }
  }, [cancelConnect, tool])

  useEffect(() => () => {
    cancelConnect()
    cancelPath()
    cancelDrag()
  }, [cancelConnect, cancelDrag, cancelPath])

  return {
    handleEdgePointerDown: (
      event: ReactPointerEvent<SVGPathElement>
    ) => {
      if (event.button !== 0) {
        return
      }

      const edgeId = event.currentTarget
        .closest('[data-edge-id]')
        ?.getAttribute('data-edge-id') as EdgeId | null
      if (!edgeId) {
        return
      }

      const entry = instance.read.edge.item.get(edgeId)
      if (!entry) {
        return
      }

      if (!hasEdge(instance.state.container.get(), entry.edge)) {
        leave(instance)
      }

      if (event.shiftKey || event.detail >= 2) {
        const point = instance.viewport.pointer(event).world
        instance.commands.edge.path.insert(edgeId, point)
        instance.commands.selection.selectEdge(edgeId)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      instance.commands.selection.selectEdge(edgeId)
      startEdgeDrag(event, edgeId, entry.edge)
      event.preventDefault()
      event.stopPropagation()
    },
    handleEndpointPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) {
        return
      }

      if (connectActiveRef.current) {
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
    },
    handlePathPointPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>,
      pathPoint: SelectedEdgePathPointView
    ) => {
      if (event.button !== 0) {
        return
      }

      if (pathActiveRef.current) {
        return
      }

      if (pathPoint.kind === 'insert') {
        const worldPoint = instance.viewport.pointer(event).world
        const result = instance.commands.edge.path.insert(pathPoint.edgeId, worldPoint)
        if (!result.ok) {
          return
        }

        const origin =
          readPathEntry(pathPoint.edgeId)?.edge.path?.points?.[result.data.index]
          ?? worldPoint
        if (!startPathDrag(event, pathPoint.edgeId, result.data.index, origin)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const entry = readPathEntry(pathPoint.edgeId)
      if (!entry) {
        return
      }

      const points = entry.edge.path?.points ?? []
      const origin = points[pathPoint.index]
      if (!origin) {
        return
      }

      if (event.detail >= 2) {
        instance.commands.edge.path.remove(pathPoint.edgeId, pathPoint.index)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (!startPathDrag(event, pathPoint.edgeId, pathPoint.index, origin)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    },
    handlePathPointKeyDown: (
      event: ReactKeyboardEvent<HTMLDivElement>,
      pathPoint: Extract<SelectedEdgePathPointView, { kind: 'anchor' }>
    ) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      const entry = readPathEntry(pathPoint.edgeId)
      if (!entry) {
        return
      }

      const points = entry.edge.path?.points ?? []
      if (pathPoint.index < 0 || pathPoint.index >= points.length) {
        return
      }

      instance.commands.edge.path.remove(pathPoint.edgeId, pathPoint.index)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
