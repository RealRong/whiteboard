import type { NodeId } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../instance'

type Instance = Pick<WhiteboardInstance, 'commands' | 'state'>

export const enter = (
  instance: Instance,
  nodeId: NodeId
) => {
  instance.commands.selection.clear()
  instance.commands.container.enter(nodeId)
}

export const leave = (
  instance: Instance
) => {
  instance.commands.selection.clear()
  if (instance.state.container.get().id) {
    instance.commands.container.exit()
  }
}
