import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { ViewportRuntime } from '../../runtime/Viewport'

type CommandDeps = {
  state: InternalInstance['state']
  viewport: ViewportRuntime
  writeRuntime: WriteRuntime
}

export const createCommands = ({
  state,
  viewport,
  writeRuntime
}: CommandDeps): Commands => {
  const { history, resetDoc, commands } = writeRuntime
  const {
    edge,
    interaction,
    viewport: viewportCommands,
    node,
    mindmap,
    selection
  } = commands

  return {
    doc: {
      reset: resetDoc
    },
    tool: {
      set: (tool) => {
        state.write('tool', tool)
      }
    },
    history: {
      get: history.get,
      configure: history.configure,
      undo: history.undo,
      redo: history.redo,
      clear: history.clear
    },
    interaction,
    host: {
      containerResized: viewport.setContainerRect
    },
    selection,
    edge,
    viewport: viewportCommands,
    node,
    mindmap
  }
}
