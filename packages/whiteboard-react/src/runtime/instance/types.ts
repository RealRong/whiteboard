import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  EngineInstance
} from '@whiteboard/engine'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { RuntimeRead } from '../read'
import type {
  Container
} from '../container'
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
import type { Tool } from '../tool'
import type { EditField, EditTarget } from '../edit'

type EngineCommands = EngineInstance['commands']

export type WhiteboardInstance = {
  read: RuntimeRead
  state: {
    tool: ReadStore<Tool>
    edit: ReadStore<EditTarget>
    selection: ReadStore<SelectionView>
    container: ReadStore<Container>
    interaction: ReadStore<InteractionMode>
  }
  commands: Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
    tool: {
      set: (tool: Tool) => void
      select: () => void
      hand: () => void
      connector: () => void
      insert: (preset: string) => void
      draw: (preset?: string) => void
    }
    edit: {
      start: (nodeId: NodeId, field: EditField) => void
      clear: () => void
    }
    selection: {
      replace: (nodeIds: readonly NodeId[]) => void
      add: (nodeIds: readonly NodeId[]) => void
      remove: (nodeIds: readonly NodeId[]) => void
      toggle: (nodeIds: readonly NodeId[]) => void
      selectEdge: (edgeId: EdgeId) => void
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
}

export type InternalInstance = WhiteboardInstance & {
  config: Readonly<EngineBoardConfig>
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
