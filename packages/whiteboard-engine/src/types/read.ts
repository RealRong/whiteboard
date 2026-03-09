import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Edge, Node } from '@whiteboard/core/types'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
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
import type { WriteCommit } from './write'

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

export type NodeReadProjection = NodeRead & {
  applyChange: (impact: ReadImpact) => void
}

export type EdgeReadProjection = EdgeRead & {
  applyChange: (
    rebuild: 'none' | 'dirty' | 'full',
    nodeIds: readonly NodeId[],
    edgeIds: readonly EdgeId[]
  ) => void
}

export type MindmapReadProjection = MindmapRead & {
  applyChange: (impact: ReadImpact) => void
}

export type ReadCommit = Extract<WriteCommit, { ok: true }>

export type ReadControl = {
  read: EngineRead
  commit: (committed: ReadCommit) => void
  rebuildMindmap: () => void
}

export type ReadDeps = {
  document: DocumentSource
  mindmapLayout: () => MindmapLayoutConfig
  config: InstanceConfig
}
