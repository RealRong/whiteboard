import type { NodeId } from '@whiteboard/core/types'
import { createValueStore } from '@whiteboard/engine'
import type { ValueStore } from '@whiteboard/engine'

export type EditField = 'text' | 'title'

export type EditTarget = {
  nodeId: NodeId
  field: EditField
} | null

export type EditStore = ValueStore<EditTarget>

export type EditCommands = {
  start: (nodeId: NodeId, field: EditField) => void
  clear: () => void
}

export type EditState = {
  store: EditStore
  commands: EditCommands
}

export const createEditState = (): EditState => {
  const store = createValueStore<EditTarget>(null)

  return {
    store,
    commands: {
      start: (nodeId, field) => {
        store.set({
          nodeId,
          field
        })
      },
      clear: () => {
        if (store.get() === null) {
          return
        }

        store.set(null)
      }
    }
  }
}
