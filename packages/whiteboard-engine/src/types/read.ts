import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Edge, Node } from '@whiteboard/core/types'
import type { NodeId } from '@whiteboard/core/types'
import type {
  DocumentSource,
  EdgeRead,
  EngineRead,
  EngineReadIndex,
  InstanceConfig,
  MindmapRead,
  NodeRead
} from './instance'
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

export type NodeReadProjection = NodeRead & {
  applyChange: (impact: KernelReadImpact) => void
}

export type EdgeReadProjection = EdgeRead & {
  applyChange: (impact: KernelReadImpact) => void
}

export type MindmapReadProjection = MindmapRead & {
  applyChange: (impact: KernelReadImpact) => void
}

export type ReadControl = {
  read: EngineRead
  invalidate: (impact: KernelReadImpact) => void
}

export type ReadDeps = {
  document: DocumentSource
  mindmapLayout: () => MindmapLayoutConfig
  config: InstanceConfig
}
