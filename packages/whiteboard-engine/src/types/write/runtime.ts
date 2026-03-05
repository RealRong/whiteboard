import type { Commands as EngineCommands } from '../command/api'
import type { Bus as ChangeBus } from './change'
import type { Apply } from './commands'

export type Write = {
  apply: Apply
  history: EngineCommands['history']
  resetDoc: EngineCommands['doc']['reset']
  changeBus: ChangeBus
}
