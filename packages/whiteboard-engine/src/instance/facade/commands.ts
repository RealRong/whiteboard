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
  const { history, resetDoc } = writeRuntime
  const {
    write,
    edge,
    interaction,
    viewport: viewportCommands,
    node,
    mindmap,
    selection
  } = writeRuntime.commands

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
    interaction: {
      update: interaction.update,
      clearHover: interaction.clearHover
    },
    host: {
      nodeMeasured: (id, size) => {
        reactions.nodeMeasured(id, size)
      },
      containerResized: (rect) => {
        viewport.setContainerRect(rect)
      }
    },
    selection: {
      select: selection.select,
      toggle: selection.toggle,
      clear: selection.clear,
      getSelectedNodeIds: selection.getSelectedNodeIds
    },
    edge: {
      create: edge.create,
      update: edge.update,
      delete: edge.delete,
      insertRoutingPoint: edge.insertRoutingPoint,
      moveRoutingPoint: edge.moveRoutingPoint,
      removeRoutingPoint: edge.removeRoutingPoint,
      resetRouting: edge.resetRouting,
      select: edge.select
    },
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
    viewport: {
      set: viewportCommands.set,
      panBy: viewportCommands.panBy,
      zoomBy: viewportCommands.zoomBy,
      zoomTo: viewportCommands.zoomTo,
      reset: viewportCommands.reset
    },
    node: {
      create: node.create,
      update: node.update,
      updateData: node.updateData,
      updateManyPosition: node.updateManyPosition,
      delete: node.delete
    },
    group: {
      create: node.createGroup,
      ungroup: node.ungroup
    },
    mindmap: {
      apply: mindmap.apply
    },
    write: {
      apply: write.apply
    }
  }
}
