import type { Commands as EngineCommands } from '../command/api'
import type { Bus as ChangeBus } from './change'
import type {
  EdgeCommandsApi,
  InteractionCommandsApi,
  MindmapCommandsApi,
  NodeCommandsApi,
  SelectionCommandsApi,
  ShortcutActionDispatcher,
  WriteCommandsApi,
  ViewportCommandsApi
} from './commands'
import type { CommandGateway } from '../cqrs/command'

export type CommandSet = {
  write: WriteCommandsApi
  edge: EdgeCommandsApi
  interaction: InteractionCommandsApi
  viewport: ViewportCommandsApi
  node: NodeCommandsApi
  mindmap: MindmapCommandsApi
  selection: SelectionCommandsApi
  shortcut: ShortcutActionDispatcher
}

export type Runtime = {
  gateway: CommandGateway
  history: EngineCommands['history']
  resetDoc: EngineCommands['doc']['reset']
  commands: CommandSet
  changeBus: ChangeBus
}
