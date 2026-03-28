import type { HistoryState } from '@whiteboard/core/kernel'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../instance/types'

export const createHistoryCommands = ({
  engine,
  history
}: {
  engine: EngineInstance
  history: {
    set: (value: HistoryState) => void
  }
}): Editor['commands']['history'] => {
  const syncHistory = () => {
    history.set(engine.commands.history.get())
  }

  return {
    get: engine.commands.history.get,
    clear: () => {
      engine.commands.history.clear()
      syncHistory()
    },
    undo: () => {
      const result = engine.commands.history.undo()
      syncHistory()
      return result
    },
    redo: () => {
      const result = engine.commands.history.redo()
      syncHistory()
      return result
    }
  }
}
