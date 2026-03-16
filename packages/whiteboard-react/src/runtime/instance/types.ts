import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { SelectionMode } from '@whiteboard/core/node'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  EngineInstance
} from '@whiteboard/engine'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type {
  Container,
  Selection
} from '../state'
import type { ViewportController } from '../viewport'
import type { NodeRegistry } from '../../types/node'
import type {
  InteractionCoordinator,
  InteractionMode
} from '../interaction/types'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgeFeatureRuntime } from '../../features/edge/session/runtime'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session/runtime'

export type Tool = 'select' | 'edge'

type EngineCommands = EngineInstance['commands']

export type BoardInstance = {
  config: Readonly<EngineBoardConfig>
  read: EngineInstance['read']
  state: {
    tool: ReadStore<Tool>
    selection: ReadStore<Selection>
    container: ReadStore<Container>
    interaction: ReadStore<InteractionMode>
  }
  commands: Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
    tool: {
      set: (tool: Tool) => void
    }
    selection: {
      select: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
      selectEdge: (edgeId?: EdgeId) => void
      selectAll: () => void
      clear: () => void
    }
    container: {
      enter: (nodeId: NodeId) => void
      exit: () => void
      clear: () => void
    }
    edge: EngineCommands['edge']
  }
  viewport: ViewportController
  configure: (config: {
    tool: Tool
    mindmapLayout: MindmapLayoutConfig
    history?: KernelHistoryConfig
  }) => void
  dispose: () => void
}

export type InternalInstance = BoardInstance & {
  engine: EngineInstance
  interaction: InteractionCoordinator
  registry: NodeRegistry
  internals: {
    node: NodeFeatureRuntime
    edge: EdgeFeatureRuntime
    mindmap: MindmapFeatureRuntime
  }
}
