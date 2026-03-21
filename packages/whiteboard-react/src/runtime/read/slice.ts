import type { SliceExportResult } from '@whiteboard/core/document'
import type { EngineRead } from '@whiteboard/engine'
import type { SelectionRead } from './selection'

export type SliceRead = EngineRead['slice'] & {
  fromSelection: () => SliceExportResult | undefined
}

export const createSliceRead = ({
  read,
  selection
}: {
  read: EngineRead
  selection: SelectionRead
}): SliceRead => ({
  fromNodes: read.slice.fromNodes,
  fromEdge: read.slice.fromEdge,
  fromSelection: () => {
    const current = selection.get()
    if (current.target.edgeId !== undefined) {
      return read.slice.fromEdge(current.target.edgeId)
    }
    if (current.target.nodeIds.length > 0) {
      return read.slice.fromNodes(current.target.nodeIds)
    }
    return undefined
  }
})
