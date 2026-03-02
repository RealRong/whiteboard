import type { Commands as EngineCommands } from '../command/api'
import type { Bus as ChangeBus } from './change'
import type { ApplyMutationsApi } from '../command/source'
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
  mutate: ApplyMutationsApi
  history: EngineCommands['history']
  resetDoc: EngineCommands['doc']['reset']
  commands: CommandSet
  changeBus: ChangeBus
}
