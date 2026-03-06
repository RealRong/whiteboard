import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

export const EMPTY_READ_INVALIDATION: ReadInvalidation = {
  index: {
    rebuild: 'none',
    nodeIds: EMPTY_NODE_IDS
  },
  edge: {
    rebuild: 'none',
    nodeIds: EMPTY_NODE_IDS,
    edgeIds: EMPTY_EDGE_IDS
  }
}

export const FULL_READ_INVALIDATION: ReadInvalidation = {
  index: {
    rebuild: 'full',
    nodeIds: EMPTY_NODE_IDS
  },
  edge: {
    rebuild: 'full',
    nodeIds: EMPTY_NODE_IDS,
    edgeIds: EMPTY_EDGE_IDS
  }
}
