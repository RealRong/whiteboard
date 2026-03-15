import type { InstanceConfig as EngineInstanceConfig } from '@whiteboard/core/config'
import type {
  Instance as EngineInstance
} from '@whiteboard/engine'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { ResolvedHistoryConfig } from '../../types/common'
import type {
  WhiteboardSelectionCommands,
  WhiteboardSelectionRead
} from '../state/selection'
import type { WhiteboardContainerCommands } from '../container/state'
import type { WhiteboardContainerRead } from '../container/read'
import type { WhiteboardViewport } from '../viewport'
import type { Transient } from '../draft/runtime'
import type { NodeRegistry } from '../../types/node'
import type { WhiteboardView } from '../view'
import type { InteractionCoordinator } from '../interaction/types'

export type EditorTool = 'select' | 'edge'

export type WhiteboardRuntimeConfig = {
  tool: EditorTool
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

type EngineCommands = EngineInstance['commands']
type EngineRead = EngineInstance['read']

export type WhiteboardCommands = Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
  tool: {
    set: (tool: EditorTool) => void
  }
  selection: WhiteboardSelectionCommands
  container: WhiteboardContainerCommands
  edge: EngineCommands['edge']
}

export type WhiteboardRead = EngineRead & {
  container: WhiteboardContainerRead
  selection: WhiteboardSelectionRead
}

export type WhiteboardInstance = {
  config: Readonly<EngineInstanceConfig>
  read: WhiteboardRead
  view: WhiteboardView
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (config: WhiteboardRuntimeConfig) => void
  dispose: () => void
}

export type InternalWhiteboardInstance = WhiteboardInstance & {
  engine: EngineInstance
  draft: Transient
  interaction: InteractionCoordinator
  registry: NodeRegistry
}
