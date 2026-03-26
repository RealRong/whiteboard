import { getNodeAnchorPoint } from '@whiteboard/core/node'
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
  type RefObject
} from 'react'
import { useInternalInstance, useTool } from '../../../runtime/hooks'
import type {
  EdgeCreateDown,
  EdgeDown
} from '../../../runtime/input/pointer'
import { readEdgeType } from '../../../runtime/tool'
import { createRafTask } from '../../../runtime/utils/rafTask'
import type { ViewportPointer } from '../../../runtime/viewport'
import type { EdgeConnectState, EdgeDraftEnd } from '../../../types/edge'
import {
  type EdgeHint,
  writeEdgePreviewPatch
} from '../preview'
import {
  type PointerSourceEvent,
  readCaptureTarget
} from './useEdgePatchSession'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveSnapTarget
} from './connect/math'

type ConnectHandleSide = EdgeAnchor['side']

type ConnectPointer = ViewportPointer & {
  pointerId: number
}

type ConnectNodeEntry = NonNullable<
  ReturnType<ReturnType<typeof useInternalInstance>['read']['index']['node']['get']>
>

const toPointDraftEnd = (
  point: Point
): EdgeDraftEnd => ({
  kind: 'point',
  point
})

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

const canReconnectEnd = (
  can: {
    reconnectSource: boolean
    reconnectTarget: boolean
  },
  end: 'source' | 'target'
) => (
  end === 'source'
    ? can.reconnectSource
    : can.reconnectTarget
)

const toReconnectPatch = (
  end: 'source' | 'target',
  value: EdgeDraftEnd
): EdgePatch => (
  end === 'source'
    ? { source: toEdgeEnd(value) }
    : { target: toEdgeEnd(value) }
)

const toConnectHint = (
  state: EdgeConnectState
): EdgeHint | undefined => {
  const line =
    state.kind === 'create' && state.to
      ? {
          from: state.from.point,
          to: state.to.point
        }
      : undefined
  const snap =
    state.to?.kind === 'node'
      ? state.to.point
      : undefined

  if (!line && !snap) {
    return undefined
  }

  return {
    line,
    snap
  }
}

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

  const clearPatch = useCallback(() => {
    instance.internals.edge.preview.patch.clear()
  }, [instance])

  const clearHint = useCallback(() => {
    instance.internals.edge.preview.hint.clear()
  }, [instance])

  const createState = useCallback((
    from: EdgeDraftEnd,
    pointer: ConnectPointer,
    edgeType: EdgeType
  ): EdgeConnectState => ({
    kind: 'create',
    pointerId: pointer.pointerId,
    edgeType,
    from,
    to: toPointDraftEnd(pointer.world)
  }), [])

  const readConnectNode = useCallback((
    nodeId: NodeId
  ): ConnectNodeEntry | undefined => {
    const entry = instance.read.index.node.get(nodeId)
    if (!entry || !instance.read.node.connect(entry.node)) {
      return undefined
    }

    return entry
  }, [instance])

  const readCreateState = useCallback((
    input: EdgeCreateDown,
    pointer: ConnectPointer,
    edgeType: EdgeType
  ): EdgeConnectState => {
    const pick = input.pick
    if (pick.kind === 'node' && pick.part === 'connect' && pick.side) {
      const entry = readConnectNode(pick.id)
      if (entry) {
        const anchor: EdgeAnchor = {
          side: pick.side,
          offset: DEFAULT_EDGE_ANCHOR_OFFSET
        }

        return createState({
          kind: 'node',
          nodeId: pick.id,
          anchor,
          point: getNodeAnchorPoint(entry.node, entry.rect, anchor, entry.rotation)
        }, pointer, edgeType)
      }
    }

    if (
      pick.kind === 'node'
      && (pick.part === 'body' || pick.part === 'shell')
    ) {
      const entry = readConnectNode(pick.id)
      if (entry) {
        const resolved = resolveAnchorFromPoint(
          instance,
          entry.node,
          entry.rect,
          entry.rotation,
          pointer.world
        )

        return createState({
          kind: 'node',
          nodeId: pick.id,
          anchor: resolved.anchor,
          point: resolved.point
        }, pointer, edgeType)
      }
    }

    return createState(toPointDraftEnd(pointer.world), pointer, edgeType)
  }, [createState, instance, readConnectNode])

  const readReconnectState = useCallback((
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: ConnectPointer
  ): EdgeConnectState | undefined => {
    const view = instance.read.edge.view.get(edgeId)
    if (!view) {
      return undefined
    }

    if (!canReconnectEnd(view.can, end)) {
      return undefined
    }

    const edgeEnd = view.edge[end]
    const resolvedEnd = view.ends[end]
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
      : toPointDraftEnd(pointer.world)
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
        toReconnectPatch(state.end, target)
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
    const next = toConnectHint(state)
    if (!next) {
      clearHint()
      return
    }

    instance.internals.edge.preview.hint.write(next)
  }, [clearHint, instance])

  const writeStatePatch = useCallback((state: EdgeConnectState) => {
    if (state.kind !== 'reconnect' || !state.to) {
      clearPatch()
      return
    }

    writeEdgePreviewPatch(
      instance.internals.edge.preview,
      state.edgeId,
      toReconnectPatch(state.end, state.to)
    )
  }, [clearPatch, instance])

  const writeStatePreview = useCallback((state: EdgeConnectState) => {
    writeStateHint(state)
    writeStatePatch(state)
  }, [writeStateHint, writeStatePatch])

  const setHoverHint = useCallback((snap?: Point) => {
    if (!snap) {
      clearHint()
      return
    }

    instance.internals.edge.preview.hint.write({ snap })
  }, [clearHint, instance])

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
    state: EdgeConnectState,
    capture?: Element | null
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'edge-connect',
      pointerId: event.pointerId,
      capture: capture ?? readCaptureTarget(event),
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
    input: EdgeCreateDown
  ) => {
    if (activeRef.current) {
      return false
    }

    const edgeType = readEdgeType(input.tool.preset)
    if (!edgeType) {
      return false
    }

    const state = readCreateState(
      input,
      readPointer(input.event),
      edgeType
    )

    return startConnectSession(input.event, state, input.capture)
  }, [
    readCreateState,
    readPointer,
    startConnectSession
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
      input: EdgeDown
    ) => {
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
      const state = readReconnectState(edgeId, end, readPointer(input.event))
      if (!state) {
        return false
      }

      instance.commands.selection.replace({
        edgeIds: [edgeId]
      })

      return startConnectSession(input.event, state, input.capture)
    }
  }
}
