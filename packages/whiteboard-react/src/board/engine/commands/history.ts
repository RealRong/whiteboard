import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types'

export const createHistoryCommands = ({
  engine
}: {
  engine: EngineInstance
}): Editor['commands']['history'] => {
  return {
    get: engine.history.get,
    clear: () => {
      engine.commands.history.clear()
    },
    undo: () => engine.commands.history.undo(),
    redo: () => engine.commands.history.redo()
  }
}
