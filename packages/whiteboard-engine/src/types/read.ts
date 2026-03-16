import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { MindmapLayoutConfig } from '@whiteboard/core/mindmap'
import type { Edge, Node } from '@whiteboard/core/types'
import type { NodeId } from '@whiteboard/core/types'
import type { BoardConfig, EngineDocument, EngineRead } from './instance'

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

export type ReadControl = {
  read: EngineRead
  invalidate: (impact: KernelReadImpact) => void
}

export type ReadDeps = {
  document: EngineDocument
  mindmapLayout: () => MindmapLayoutConfig
  config: BoardConfig
}
