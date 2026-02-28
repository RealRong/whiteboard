import { atom, type Atom } from 'jotai/vanilla'
import type { Node } from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import { buildIndexById, EMPTY_INDEX_BY_ID, EMPTY_NODE_MAP } from './shared'

export const indexes = (
  visibleNodesAtom: Atom<Node[]>,
  canvasNodesAtom: Atom<Node[]>
): Atom<ReadModelSnapshot['indexes']> => {
  let visibleNodesRef: Node[] | undefined
  let canvasNodesRef: Node[] | undefined

  let canvasNodeById = EMPTY_NODE_MAP
  let visibleNodeIndexById = EMPTY_INDEX_BY_ID
  let canvasNodeIndexById = EMPTY_INDEX_BY_ID

  return atom((get) => {
    const visibleNodes = get(visibleNodesAtom)
    const canvasNodes = get(canvasNodesAtom)

    if (canvasNodes !== canvasNodesRef) {
      canvasNodeById = canvasNodes.length
        ? new Map(canvasNodes.map((node) => [node.id, node]))
        : EMPTY_NODE_MAP
      canvasNodeIndexById = canvasNodes.length
        ? buildIndexById(canvasNodes)
        : EMPTY_INDEX_BY_ID
      canvasNodesRef = canvasNodes
    }

    if (visibleNodes !== visibleNodesRef) {
      visibleNodeIndexById = visibleNodes.length
        ? buildIndexById(visibleNodes)
        : EMPTY_INDEX_BY_ID
      visibleNodesRef = visibleNodes
    }

    return {
      canvasNodeById,
      visibleNodeIndexById,
      canvasNodeIndexById
    }
  })
}
