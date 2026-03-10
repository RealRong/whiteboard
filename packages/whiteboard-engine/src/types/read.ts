import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Edge, Node } from '@whiteboard/core/types'
import type { NodeId } from '@whiteboard/core/types'
import type { EngineDocument, EngineRead, InstanceConfig } from './instance'
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

export type ReadControl = {
  read: EngineRead
  invalidate: (impact: KernelReadImpact) => void
}

export type ReadDeps = {
  document: EngineDocument
  mindmapLayout: () => MindmapLayoutConfig
  config: InstanceConfig
}
