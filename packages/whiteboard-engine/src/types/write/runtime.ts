import type { Commands as EngineCommands } from '../command/api'
import type { Subscribe } from './change'
import type { Apply } from './commands'

export type Write = {
  apply: Apply
  load: EngineCommands['doc']['load']
  replace: EngineCommands['doc']['replace']
  history: EngineCommands['history']
  subscribe: Subscribe
}
