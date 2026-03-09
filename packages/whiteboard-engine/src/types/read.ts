import type { PrimitiveAtom, createStore } from 'jotai/vanilla'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import type { Document, Edge, Node } from '@whiteboard/core/types'
import type {
  CanvasNodeRect,
  EdgesView,
  InstanceConfig,
  MindmapView,
  NodesView
} from './instance'
import type { MindmapLayoutConfig } from './mindmap'
import type { SnapCandidate } from './node'
import type { KernelReadImpact } from '@whiteboard/core/kernel'

export type ReadModel = {
  nodes: {
    visible: Node[]
    canvas: Node[]
  }
  edges: {
    visible: Edge[]
  }
  indexes: {
    canvasNodeById: Map<NodeId, Node>
    canvasNodeIds: NodeId[]
  }
}

export type CanvasQueryContext = {
  all: () => CanvasNodeRect[]
  byId: (nodeId: NodeId) => CanvasNodeRect | undefined
  idsInRect: (rect: Rect) => NodeId[]
}

export type SnapQueryContext = {
  all: () => SnapCandidate[]
  inRect: (rect: Rect) => SnapCandidate[]
}

export type ReadIndexes = {
  canvas: CanvasQueryContext
  snap: SnapQueryContext
}

export type IndexCanvasSource = Pick<CanvasQueryContext, 'all' | 'byId'>

export type ReadContext = {
  mindmapLayout: () => MindmapLayoutConfig
  model: () => ReadModel
  indexes: ReadIndexes
  config: InstanceConfig
}

export type ReadImpact = KernelReadImpact

export type NodeReadProjection = {
  getView: () => NodesView
}

export type EdgeReadProjection = {
  applyChange: (
    rebuild: 'none' | 'dirty' | 'full',
    nodeIds: readonly NodeId[],
    edgeIds: readonly EdgeId[]
  ) => void
  getView: () => EdgesView
}

export type MindmapReadProjection = {
  getView: () => MindmapView
}

export type ReadDeps = {
  store: ReturnType<typeof createStore>
  documentAtom: PrimitiveAtom<Document>
  getMindmapLayout: () => MindmapLayoutConfig
  config: InstanceConfig
}
