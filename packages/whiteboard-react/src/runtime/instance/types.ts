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
  Container
} from '../state'
import type { View as SelectionView } from '../selection'
import type {
  ViewportCommands,
  ViewportRead
} from '../viewport'
import type { ViewportRuntime } from '../viewport/createViewport'
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
    selection: ReadStore<SelectionView>
    container: ReadStore<Container>
    interaction: ReadStore<InteractionMode>
  }
  commands: Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
    tool: {
      set: (tool: Tool) => void
    }
    selection: {
      nodes: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
      edge: (edgeId?: EdgeId) => void
      clear: () => void
    }
    container: {
      enter: (nodeId: NodeId) => void
      exit: () => void
      clear: () => void
    }
    viewport: ViewportCommands
    edge: EngineCommands['edge']
  }
  viewport: ViewportRead
  configure: (config: {
    tool: Tool
    viewport: {
      minZoom: number
      maxZoom: number
    }
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
    viewport: ViewportRuntime
    node: NodeFeatureRuntime
    edge: EdgeFeatureRuntime
    mindmap: MindmapFeatureRuntime
  }
}
