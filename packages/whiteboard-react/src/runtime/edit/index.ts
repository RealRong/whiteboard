import { createValueStore } from '@whiteboard/core/runtime'
import type { NodeId } from '@whiteboard/core/types'

export type EditField = 'text' | 'title'

export type EditTarget = {
  nodeId: NodeId
  field: EditField
} | null

export type Store = ReturnType<typeof createValueStore<EditTarget>>

export type Commands = {
  start: (nodeId: NodeId, field: EditField) => void
  clear: () => void
}

export type State = {
  store: Store
  commands: Commands
}

export const createState = (): State => {
  const store = createValueStore<EditTarget>(null)

  return {
    store,
    commands: {
      start: (nodeId: NodeId, field: EditField) => {
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
