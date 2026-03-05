import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { Write } from '@engine-types/write/runtime'
import type { ViewportHost } from '../../runtime/Viewport'
import {
  edge,
  interaction,
  mindmap,
  node,
  selection,
  shortcut,
  viewport as viewportCommands
} from '../../runtime/write/api'

type CommandDeps = {
  instance: Pick<InternalInstance, 'state' | 'document' | 'read'>
  viewport: ViewportHost
  write: Write
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
  const selectionCommands = selection({
    instance,
    apply: write.apply
  })
  const interactionCommands = interaction({ instance })

  return {
    doc: {
      reset: write.resetDoc
    },
    tool: {
      set: (tool) => {
        instance.state.write('tool', tool)
      }
    },
    history: {
      get: write.history.get,
      configure: write.history.configure,
      undo: write.history.undo,
      redo: write.history.redo,
      clear: write.history.clear
    },
    interaction: interactionCommands,
    host: {
      containerResized: viewport.setContainerRect
    },
    selection: selectionCommands,
    edge: edgeCommands,
    shortcut: shortcut({
      state: instance.state,
      selection: selectionCommands,
      history: write.history
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
