import { getNodeAnchorPoint } from '@whiteboard/core/node'
import type {
  EdgeAnchor,
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
  type RefObject
} from 'react'
import type { CanvasDown } from '../../../runtime/input/down'
import {
  hasEdge
} from '../../../runtime/frame'
import { useInternalInstance, useTool } from '../../../runtime/hooks'
import { readEdgeType } from '../../../runtime/tool'
import { createRafTask } from '../../../runtime/utils/rafTask'
import type { EdgeConnectState, EdgeDraftEnd } from '../../../types/edge'
import {
  type EdgeHint,
  toPatchEntry
} from '../preview'
import {
  ConnectHandleSide,
  type ConnectPointer,
  type PointerSourceEvent,
  readCaptureTarget,
  toEdgeEnd
} from './inputShared'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveSnapTarget
} from './connect/math'

export const useEdgeConnectInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const activeRef = useRef<EdgeConnectState | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)
  const hoverPointRef = useRef<Point | null>(null)

  const readPointer = useCallback((
    event: Pick<PointerSourceEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...instance.viewport.pointer(event)
  }), [instance])

  const writePatch = useCallback((
    edgeId: EdgeId,
    patch: EdgePatch,
    activePathIndex?: number
  ) => {
    instance.internals.edge.preview.patch.write([
      toPatchEntry(edgeId, patch, activePathIndex)
    ])
  }, [instance])

  const clearPatch = useCallback(() => {
    instance.internals.edge.preview.patch.clear()
  }, [instance])

  const writeHint = useCallback((next: EdgeHint) => {
    instance.internals.edge.preview.hint.write(next)
  }, [instance])

  const clearHint = useCallback(() => {
    instance.internals.edge.preview.hint.clear()
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
    const node = instance.read.node.item.get(nodeId)?.node
    if (!node || !instance.read.node.connect(node)) {
      return undefined
    }

    const entry = instance.read.index.node.get(nodeId)
    if (!entry) {
      return undefined
    }

    const resolved = resolveAnchorFromPoint(
      instance,
      entry.node,
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
    const node = instance.read.node.item.get(nodeId)?.node
    if (!node || !instance.read.node.connect(node)) {
      return undefined
    }

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
        point: getNodeAnchorPoint(entry.node, entry.rect, anchor, entry.rotation)
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

  const writeStateHint = useCallback((state: EdgeConnectState) => {
    const next: EdgeHint = {
      line:
        state.kind === 'create' && state.from && state.to
          ? {
              from: state.from.point,
              to: state.to.point
            }
          : undefined,
      snap:
        state.to?.kind === 'node'
          ? state.to.point
          : undefined
    }

    if (!next.line && !next.snap) {
      clearHint()
      return
    }

    writeHint(next)
  }, [clearHint, writeHint])

  const writeStatePatch = useCallback((state: EdgeConnectState) => {
    if (state.kind !== 'reconnect' || !state.to) {
      clearPatch()
      return
    }

    writePatch(
      state.edgeId,
      state.end === 'source'
        ? { source: toEdgeEnd(state.to) }
        : { target: toEdgeEnd(state.to) }
    )
  }, [clearPatch, writePatch])

  const writeStatePreview = useCallback((state: EdgeConnectState) => {
    writeStateHint(state)
    writeStatePatch(state)
  }, [writeStateHint, writeStatePatch])

  const setHoverHint = useCallback((snap?: Point) => {
    if (!snap) {
      clearHint()
      return
    }

    writeHint({ snap })
  }, [clearHint, writeHint])

  const updateActive = useCallback((pointer: ConnectPointer) => {
    const active = activeRef.current
    if (!active) {
      return false
    }

    if (!updateConnectState(active, pointer)) {
      return false
    }

    writeStatePreview(active)
    return true
  }, [updateConnectState, writeStatePreview])

  const hoverTaskRef = useRef(createRafTask(() => {
    const hoverPoint = hoverPointRef.current
    if (!hoverPoint || activeRef.current || !instance.read.tool.is('edge')) {
      return
    }

    const target = resolveSnapTarget(instance, hoverPoint)
    setHoverHint(target?.pointWorld)
  }))

  const clearConnect = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    hoverTaskRef.current.cancel()
    hoverPointRef.current = null
    instance.internals.edge.preview.clear()
  }, [instance])

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

          updateActive(readPointer({
            pointerId: active.pointerId,
            ...pointer
          }))
        }
      },
      cleanup: clearConnect,
      move: (moveEvent, session) => {
        if (!updateActive(readPointer(moveEvent))) {
          return
        }

        session.pan(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        commitConnectState(active)
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    activeRef.current = state
    sessionRef.current = nextSession
    writeStatePreview(state)

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clearConnect, commitConnectState, readPointer, updateActive, writeStatePreview])

  const create = useCallback((
    input: CanvasDown
  ) => {
    const { event } = input

    if (event.defaultPrevented) return false
    if (event.button !== 0) return false
    if (activeRef.current) return false
    if (input.mode !== 'idle' || input.tool.type !== 'edge') return false

    const edgeType = readEdgeType(input.tool.preset)
    if (!edgeType) {
      return false
    }

    const pointerState = readPointer(event)
    const pick = input.pick

    if (pick.kind === 'node' && pick.part === 'connect' && pick.side) {
      const state = beginFromHandle(pick.id, pick.side, pointerState, edgeType)
      if (!state) {
        return false
      }

      return startConnectSession({
        ...event,
        currentTarget: input.capture
      }, state)
    }

    if (input.editable || input.ignoreInput || input.ignoreSelection) {
      return false
    }

    if (
      pick.kind !== 'node'
      || (pick.part !== 'body' && pick.part !== 'container')
    ) {
      return startConnectSession({
        ...event,
        currentTarget: input.capture
      }, beginFromPoint(pointerState, edgeType))
    }

    const state = beginFromNode(pick.id, pointerState, edgeType)
    if (!state) {
      return startConnectSession({
        ...event,
        currentTarget: input.capture
      }, beginFromPoint(pointerState, edgeType))
    }

    return startConnectSession({
      ...event,
      currentTarget: input.capture
    }, state)
  }, [
    beginFromHandle,
    beginFromNode,
    beginFromPoint,
    instance,
    readPointer,
    startConnectSession,
    tool
  ])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      hoverPointRef.current = instance.viewport.pointer(event).world
      hoverTaskRef.current.schedule()
    }

    const handlePointerLeave = () => {
      hoverTaskRef.current.cancel()
      hoverPointRef.current = null
      clearHint()
    }

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      hoverTaskRef.current.cancel()
      hoverPointRef.current = null
      clearHint()
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [
    containerRef,
    instance,
    clearHint
  ])

  useEffect(() => {
    if (tool.type !== 'edge' && activeRef.current?.kind === 'create') {
      cancelConnect()
    }
  }, [cancelConnect, tool])

  useEffect(() => () => {
    cancelConnect()
  }, [cancelConnect])

  return {
    create,
    reconnect: (
      input: CanvasDown
    ) => {
      const { event } = input

      if (event.button !== 0) {
        return false
      }

      if (activeRef.current) {
        return false
      }

      if (
        input.pick.kind !== 'edge'
        || input.pick.part !== 'end'
        || !input.pick.end
      ) {
        return false
      }

      const edgeId = input.pick.id
      const end = input.pick.end
      const entry = instance.read.edge.item.get(edgeId)
      if (!entry) {
        return false
      }

      if (!hasEdge(instance.state.frame.get(), entry.edge)) {
        instance.commands.frame.exit()
      }

      instance.commands.selection.replace({
        edgeIds: [edgeId]
      })

      const state = beginReconnect(edgeId, end, readPointer(event))
      if (!state) {
        return false
      }

      return startConnectSession({
        ...event,
        currentTarget: input.capture
      }, state)
    }
  }
}
