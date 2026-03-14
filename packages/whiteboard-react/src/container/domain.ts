import { atom } from 'jotai/vanilla'
import type { createStore } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'

export type WhiteboardContainerCommands = {
  enter: (nodeId: NodeId) => void
  exit: () => void
  clear: () => void
}

type ContainerDomain = {
  state: {
    activeContainerId: () => NodeId | undefined
  }
  commands: WhiteboardContainerCommands
}

export const activeContainerIdAtom = atom<NodeId | undefined>(undefined)

export const createContainerDomain = ({
  uiStore
}: {
  uiStore: ReturnType<typeof createStore>
}): ContainerDomain => {
  const readActiveContainerId = () => uiStore.get(activeContainerIdAtom)

  const writeActiveContainerId = (nodeId?: NodeId) => {
    if (readActiveContainerId() === nodeId) return
    uiStore.set(activeContainerIdAtom, nodeId)
  }

  const clear = () => {
    writeActiveContainerId(undefined)
  }

  return {
    state: {
      activeContainerId: readActiveContainerId
    },
    commands: {
      enter: writeActiveContainerId,
      exit: clear,
      clear
    }
  }
}
