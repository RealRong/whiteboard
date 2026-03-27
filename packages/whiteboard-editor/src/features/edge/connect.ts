import { DEFAULT_EDGE_ANCHOR_OFFSET } from '@whiteboard/core/edge'
import type {
  EdgeAnchor,
  EdgeEnd,
  EdgeId,
  EdgeInput,
  EdgePatch,
  EdgeType,
  NodeId,
  Point
} from '@whiteboard/core/types'

export { DEFAULT_EDGE_ANCHOR_OFFSET }

export type EdgeDraftEnd =
  | {
      kind: 'node'
      nodeId: NodeId
      anchor: EdgeAnchor
      point: Point
    }
  | {
      kind: 'point'
      point: Point
    }

type EdgeConnectBase = {
  pointerId: number
  from: EdgeDraftEnd
  to?: EdgeDraftEnd
}

export type EdgeConnectState =
  | (EdgeConnectBase & {
      kind: 'create'
      edgeType: EdgeType
    })
  | (EdgeConnectBase & {
      kind: 'reconnect'
      edgeId: EdgeId
      end: 'source' | 'target'
    })

export type EdgeConnectHint = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

export type EdgeConnectCommit =
  | {
      kind: 'create'
      input: EdgeInput
    }
  | {
      kind: 'reconnect'
      edgeId: EdgeId
      end: 'source' | 'target'
      target: EdgeEnd
    }

export const toPointDraftEnd = (
  point: Point
): EdgeDraftEnd => ({
  kind: 'point',
  point
})

export const toEdgeDraftEnd = (
  pointWorld: Point,
  target?: {
    nodeId: NodeId
    anchor: EdgeAnchor
    pointWorld: Point
  }
): EdgeDraftEnd => (
  target
    ? {
        kind: 'node',
        nodeId: target.nodeId,
        anchor: target.anchor,
        point: target.pointWorld
      }
    : toPointDraftEnd(pointWorld)
)

export const toEdgeEnd = (
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

export const startEdgeCreate = ({
  pointerId,
  edgeType,
  from,
  to
}: {
  pointerId: number
  edgeType: EdgeType
  from: EdgeDraftEnd
  to: EdgeDraftEnd
}): EdgeConnectState => ({
  kind: 'create',
  pointerId,
  edgeType,
  from,
  to
})

export const startEdgeReconnect = ({
  pointerId,
  edgeId,
  end,
  from
}: {
  pointerId: number
  edgeId: EdgeId
  end: 'source' | 'target'
  from: EdgeDraftEnd
}): EdgeConnectState => ({
  kind: 'reconnect',
  pointerId,
  edgeId,
  end,
  from
})

export const resolveReconnectDraftEnd = ({
  end,
  point,
  anchor,
  anchorOffset = DEFAULT_EDGE_ANCHOR_OFFSET
}: {
  end: EdgeEnd
  point: Point
  anchor?: EdgeAnchor
  anchorOffset?: number
}): EdgeDraftEnd => (
  end.kind === 'node'
    ? {
        kind: 'node',
        nodeId: end.nodeId,
        anchor: end.anchor ?? {
          side: anchor?.side ?? 'right',
          offset: anchor?.offset ?? anchorOffset
        },
        point
      }
    : {
        kind: 'point',
        point
      }
)

export const setEdgeConnectTarget = (
  state: EdgeConnectState,
  to: EdgeDraftEnd
): EdgeConnectState => ({
  ...state,
  to
})

export const toEdgeConnectHint = (
  state: EdgeConnectState
): EdgeConnectHint | undefined => {
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

export const toEdgeConnectPatch = (
  state: EdgeConnectState
): EdgePatch | undefined => {
  if (state.kind !== 'reconnect' || !state.to) {
    return undefined
  }

  return state.end === 'source'
    ? { source: toEdgeEnd(state.to) }
    : { target: toEdgeEnd(state.to) }
}

export const toEdgeConnectCommit = (
  state: EdgeConnectState
): EdgeConnectCommit | undefined => {
  if (!state.to) {
    return undefined
  }

  if (state.kind === 'reconnect') {
    return {
      kind: 'reconnect',
      edgeId: state.edgeId,
      end: state.end,
      target: toEdgeEnd(state.to)
    }
  }

  return {
    kind: 'create',
    input: {
      source: toEdgeEnd(state.from),
      target: toEdgeEnd(state.to),
      type: state.edgeType
    }
  }
}
