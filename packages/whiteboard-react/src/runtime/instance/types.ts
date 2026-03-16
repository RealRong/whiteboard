import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { ReadStore } from '@whiteboard/core/runtime'
import type {
  EngineInstance
} from '@whiteboard/engine'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { ResolvedHistoryConfig } from '../../types/common'
import type {
  Container,
  Selection,
  WhiteboardContainerCommands,
  WhiteboardSelectionCommands
} from '../state'
import type { WhiteboardViewport } from '../viewport'
import type { NodeRegistry } from '../../types/node'
import type {
  InteractionCoordinator,
  InteractionMode
} from '../interaction/types'
import type { NodeFeatureRuntime } from '../../features/node/session'
import type { EdgeFeatureRuntime } from '../../features/edge/session'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session'
import type { SelectionBoxStore } from '../session/selectionBox'

export type Tool = 'select' | 'edge'

export type WhiteboardRuntimeOptions = {
  tool: Tool
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

type EngineCommands = EngineInstance['commands']
type EngineRead = EngineInstance['read']

export type WhiteboardCommands = Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
  tool: {
    set: (tool: Tool) => void
  }
  selection: WhiteboardSelectionCommands
  container: WhiteboardContainerCommands
  edge: EngineCommands['edge']
}

export type WhiteboardRead = EngineRead

export type WhiteboardState = {
  tool: ReadStore<Tool>
  selection: ReadStore<Selection>
  container: ReadStore<Container>
  interaction: ReadStore<InteractionMode>
}

export type WhiteboardInstance = {
  config: Readonly<EngineBoardConfig>
  read: WhiteboardRead
  state: WhiteboardState
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (config: WhiteboardRuntimeOptions) => void
  dispose: () => void
}

export type InternalWhiteboardInstance = WhiteboardInstance & {
  engine: EngineInstance
  interaction: InteractionCoordinator
  registry: NodeRegistry
  internals: {
    node: NodeFeatureRuntime
    edge: EdgeFeatureRuntime
    mindmap: MindmapFeatureRuntime
    selectionBox: SelectionBoxStore
  }
}
