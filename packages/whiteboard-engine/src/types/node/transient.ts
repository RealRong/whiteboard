import type { NodeId } from '@whiteboard/core'
import type { NodeViewUpdate } from '../graph'

export type NodeTransientApi = {
  setOverrides: (updates: NodeViewUpdate[]) => void
  clearOverrides: (ids?: NodeId[]) => void
  commitOverrides: (updates?: NodeViewUpdate[]) => void
}
