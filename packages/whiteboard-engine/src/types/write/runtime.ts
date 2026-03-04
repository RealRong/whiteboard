import type { Commands as EngineCommands } from '../command/api'
import type { Bus as ChangeBus } from './change'
import type {
  Apply,
  EdgeCommandsApi,
  InteractionCommandsApi,
  MindmapCommandsApi,
  NodeCommandsApi,
  SelectionCommandsApi,
  ShortcutActionDispatcher,
  ViewportCommandsApi
} from './commands'

export type CommandSet = {
  edge: EdgeCommandsApi
  interaction: InteractionCommandsApi
  viewport: ViewportCommandsApi
  node: NodeCommandsApi
  mindmap: MindmapCommandsApi
  selection: SelectionCommandsApi
  shortcut: ShortcutActionDispatcher
}

export type Runtime = {
  apply: Apply
  history: EngineCommands['history']
  resetDoc: EngineCommands['doc']['reset']
  commands: CommandSet
  changeBus: ChangeBus
}
