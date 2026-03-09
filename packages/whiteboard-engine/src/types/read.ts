import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Edge, Node } from '@whiteboard/core/types'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  DocumentSource,
  EdgesView,
  EngineRead,
  EngineReadIndex,
  InstanceConfig,
  MindmapView,
  NodesView,
  ReadSubscriptionKey
} from './instance'
import { READ_KEYS } from './instance'
import type { MindmapLayoutConfig } from './mindmap'

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

export type NodeIndexQueries = EngineReadIndex['node']

export type SnapIndexQueries = EngineReadIndex['snap']

export type ReadIndexes = {
  node: NodeIndexQueries
  snap: SnapIndexQueries
}

export type NodeIndexSource = Pick<NodeIndexQueries, 'all' | 'byId'>

export type ReadContext = {
  mindmapLayout: () => MindmapLayoutConfig
  model: () => ReadModel
  indexes: ReadIndexes
  config: InstanceConfig
}

export type ReadImpact = KernelReadImpact

export type ProjectionSubscriptionKey = Exclude<
  ReadSubscriptionKey,
  typeof READ_KEYS.viewport
>

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

export type ReadControl = {
  read: EngineRead
  invalidate: {
    impact: (impact: ReadImpact) => void
    reset: () => void
    mindmap: () => void
  }
}

export type ReadDeps = {
  document: DocumentSource
  mindmapLayout: () => MindmapLayoutConfig
  config: InstanceConfig
}
