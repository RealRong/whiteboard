import { atom, type Atom } from 'jotai/vanilla'
import type { NodeId, Node } from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { NodeSlices } from './nodes'
import { EMPTY_NODE_MAP } from './shared'

export const indexes = (
  nodeSlicesAtom: Atom<NodeSlices>
): Atom<ReadModelSnapshot['indexes']> => {
  let canvasNodeByIdRef: Map<NodeId, Node> = EMPTY_NODE_MAP
  let indexesCache: ReadModelSnapshot['indexes'] = {
    canvasNodeById: EMPTY_NODE_MAP
  }

  return atom((get) => {
    const canvasNodeById = get(nodeSlicesAtom).canvasNodeById
    if (canvasNodeById !== canvasNodeByIdRef) {
      canvasNodeByIdRef = canvasNodeById
      indexesCache = {
        canvasNodeById
      }
    }
    return indexesCache
  })
}
