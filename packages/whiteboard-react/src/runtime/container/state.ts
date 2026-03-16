import type { NodeId } from '@whiteboard/core/types'
import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'

export type WhiteboardContainerCommands = {
  enter: (nodeId: NodeId) => void
  exit: () => void
  clear: () => void
}

export type ContainerStore = {
  store: ValueStore<NodeId | undefined>
  commands: WhiteboardContainerCommands
}

export const createContainerStore = (): ContainerStore => {
  const store = createValueStore<NodeId | undefined>(undefined)
  const readActiveContainerId = () => store.get()

  const writeActiveContainerId = (nodeId?: NodeId) => {
    if (readActiveContainerId() === nodeId) return
    store.set(nodeId)
  }

  const clear = () => {
    writeActiveContainerId(undefined)
  }

  return {
    store,
    commands: {
      enter: writeActiveContainerId,
      exit: clear,
      clear
    }
  }
}
