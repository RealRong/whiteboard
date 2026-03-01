import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import type {
  Document,
  Edge,
  Node
} from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'

type SnapshotOptions = {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
  visibleNodesAtom: Atom<Node[]>
  canvasNodesAtom: Atom<Node[]>
  visibleEdgesAtom: Atom<Edge[]>
  indexesAtom: Atom<ReadModelSnapshot['indexes']>
}

export const snapshot = ({
  documentAtom,
  revisionAtom,
  visibleNodesAtom,
  canvasNodesAtom,
  visibleEdgesAtom,
  indexesAtom
}: SnapshotOptions): Atom<ReadModelSnapshot> => {
  let cache: ReadModelSnapshot | undefined

  return atom((get) => {
    const doc = get(documentAtom)
    const revision = get(revisionAtom)
    const visibleNodes = get(visibleNodesAtom)
    const canvasNodes = get(canvasNodesAtom)
    const visibleEdges = get(visibleEdgesAtom)
    const snapshotIndexes = get(indexesAtom)

    if (
      cache &&
      cache.revision === revision &&
      cache.docId === doc.id &&
      cache.nodes.visible === visibleNodes &&
      cache.nodes.canvas === canvasNodes &&
      cache.edges.visible === visibleEdges &&
      cache.indexes.canvasNodeById === snapshotIndexes.canvasNodeById
    ) {
      return cache
    }

    cache = {
      revision,
      docId: doc.id,
      nodes: {
        visible: visibleNodes,
        canvas: canvasNodes
      },
      edges: {
        visible: visibleEdges
      },
      indexes: snapshotIndexes
    }
    return cache
  })
}
