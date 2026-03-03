import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { ViewportRuntime } from '../../runtime/Viewport'
import type { Reactions } from '../reactions/Reactions'

type CommandDeps = {
  state: InternalInstance['state']
  viewport: ViewportRuntime
  reactions: Pick<Reactions, 'nodeMeasured'>
  writeRuntime: WriteRuntime
}

export const createCommands = ({
  state,
  viewport,
  reactions,
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
      nodeMeasured: reactions.nodeMeasured,
      containerResized: viewport.setContainerRect
    },
    selection,
    edge,
    order: {
      node: {
        set: node.setOrder,
        bringToFront: node.bringToFront,
        sendToBack: node.sendToBack,
        bringForward: node.bringForward,
        sendBackward: node.sendBackward
      },
      edge: {
        set: edge.setOrder,
        bringToFront: edge.bringToFront,
        sendToBack: edge.sendToBack,
        bringForward: edge.bringForward,
        sendBackward: edge.sendBackward
      }
    },
    viewport: viewportCommands,
    node,
    group: {
      create: node.createGroup,
      ungroup: node.ungroup
    },
    mindmap
  }
}
