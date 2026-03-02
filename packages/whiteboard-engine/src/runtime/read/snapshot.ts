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

const isSameSnapshotRefs = (
  cache: ReadModelSnapshot | undefined,
  {
    revision,
    docId,
    visibleNodes,
    canvasNodes,
    visibleEdges,
    canvasNodeById
  }: {
    revision: number
    docId: string
    visibleNodes: Node[]
    canvasNodes: Node[]
    visibleEdges: Edge[]
    canvasNodeById: ReadModelSnapshot['indexes']['canvasNodeById']
  }
): cache is ReadModelSnapshot => {
  if (!cache) return false
  return (
    cache.revision === revision &&
    cache.docId === docId &&
    cache.nodes.visible === visibleNodes &&
    cache.nodes.canvas === canvasNodes &&
    cache.edges.visible === visibleEdges &&
    cache.indexes.canvasNodeById === canvasNodeById
  )
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

    if (isSameSnapshotRefs(cache, {
      revision,
      docId: doc.id,
      visibleNodes,
      canvasNodes,
      visibleEdges,
      canvasNodeById: snapshotIndexes.canvasNodeById
    })) {
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
