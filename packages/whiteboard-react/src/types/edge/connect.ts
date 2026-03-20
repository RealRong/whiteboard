import type { EdgeAnchor, EdgeId, EdgeType, NodeId, Point } from '@whiteboard/core/types'

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
