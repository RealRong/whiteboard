import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { Write } from '@engine-types/write/runtime'
import type { ViewportHost } from '../../runtime/Viewport'
import { createInitialState } from '../../state/initialState'
import {
  edge,
  interaction,
  mindmap,
  node,
  viewport as viewportCommands
} from '../../runtime/write/api'
import { createSelectionCommands } from './selection'
import { createShortcutCommands } from './shortcut'

type CommandDeps = {
  instance: Pick<InternalInstance, 'state' | 'document' | 'read'>
  viewport: ViewportHost
  write: Write
}

const clearTransientState = (state: InternalInstance['state']) => {
  const initialState = createInitialState()
  state.batch(() => {
    state.write('selection', initialState.selection)
    state.write('interaction', initialState.interaction)
  })
}

export const createCommands = ({
  instance,
  viewport,
  write
}: CommandDeps): Commands => {
  const nodeCommands = node({
    instance,
    apply: write.apply
  })
  const edgeCommands = edge({
    instance,
    apply: write.apply
  })
  const selectionCommands = createSelectionCommands({
    instance,
    write
  })
  const interactionCommands = interaction({ instance })
  const historyCommands: Commands['history'] = {
    get: write.history.get,
    configure: write.history.configure,
    undo: write.history.undo,
    redo: write.history.redo,
    clear: write.history.clear
  }
  const applyDocument = async (
    mode: 'load' | 'replace',
    doc: Parameters<Commands['doc']['load']>[0]
  ) => {
    clearTransientState(instance.state)
    return write[mode](doc)
  }

  return {
    doc: {
      load: async (doc) => applyDocument('load', doc),
      replace: async (doc) => applyDocument('replace', doc)
    },
    tool: {
      set: (tool) => {
        instance.state.write('tool', tool)
      }
    },
    history: historyCommands,
    interaction: interactionCommands,
    host: {
      containerResized: viewport.setContainerRect
    },
    selection: selectionCommands,
    edge: edgeCommands,
    shortcut: createShortcutCommands({
      state: instance.state,
      selection: selectionCommands,
      history: historyCommands
    }),
    viewport: viewportCommands({
      apply: write.apply
    }),
    node: nodeCommands,
    mindmap: mindmap({
      apply: write.apply
    })
  }
}
