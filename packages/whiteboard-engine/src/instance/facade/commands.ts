import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { Write } from '@engine-types/write/runtime'
import type { ViewportHost } from '../../runtime/Viewport'
import {
  edge,
  interaction,
  mindmap,
  node,
  viewport as viewportCommands
} from '../../runtime/write/api'
import { createSelectionCommands } from './selection'

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
  const selectionCommands = createSelectionCommands({
    instance
  })
  const interactionCommands = interaction({ instance })
  const historyCommands: Commands['history'] = {
    get: write.history.get,
    configure: write.history.configure,
    undo: write.history.undo,
    redo: write.history.redo,
    clear: write.history.clear
  }

  return {
    doc: {
      load: write.load,
      replace: write.replace
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
    viewport: viewportCommands({
      apply: write.apply
    }),
    node: nodeCommands,
    mindmap: mindmap({
      apply: write.apply
    })
  }
}
