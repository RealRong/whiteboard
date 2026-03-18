import type { ReadStore } from '@whiteboard/core/runtime'
import type { NodeId } from '@whiteboard/core/types'
import type {
  EditField,
  EditTarget
} from '../edit'

export type EditRead = {
  get: () => EditTarget
  is: (nodeId: NodeId, field?: EditField) => boolean
}

export const createEditRead = ({
  edit
}: {
  edit: ReadStore<EditTarget>
}): EditRead => ({
  get: () => edit.get(),
  is: (nodeId, field) => {
    const target = edit.get()
    if (!target || target.nodeId !== nodeId) {
      return false
    }
    return field === undefined ? true : target.field === field
  }
})
