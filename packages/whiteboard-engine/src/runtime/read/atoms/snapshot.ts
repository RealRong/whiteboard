import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import type { Document, Edge, Node, NodeId } from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'

type SnapshotOptions = {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
  visibleNodesAtom: Atom<Node[]>
  canvasNodesAtom: Atom<Node[]>
  visibleEdgesAtom: Atom<Edge[]>
  mindmapRootsAtom: Atom<NodeId[]>
  indexesAtom: Atom<ReadModelSnapshot['indexes']>
}

export const snapshot = ({
  documentAtom,
  revisionAtom,
  visibleNodesAtom,
  canvasNodesAtom,
  visibleEdgesAtom,
  mindmapRootsAtom,
  indexesAtom
}: SnapshotOptions): Atom<ReadModelSnapshot> => {
  let cache: ReadModelSnapshot | undefined

  return atom((get) => {
    const doc = get(documentAtom)
    const revision = get(revisionAtom)
    const visibleNodes = get(visibleNodesAtom)
    const canvasNodes = get(canvasNodesAtom)
    const visibleEdges = get(visibleEdgesAtom)
    const mindmapRoots = get(mindmapRootsAtom)
    const indexes = get(indexesAtom)

    if (
      cache
      && cache.revision === revision
      && cache.docId === doc.id
      && cache.nodes.visible === visibleNodes
      && cache.nodes.canvas === canvasNodes
      && cache.edges.visible === visibleEdges
      && cache.mindmap.roots === mindmapRoots
      && cache.indexes.canvasNodeById === indexes.canvasNodeById
      && cache.indexes.visibleNodeIndexById === indexes.visibleNodeIndexById
      && cache.indexes.canvasNodeIndexById === indexes.canvasNodeIndexById
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
      mindmap: {
        roots: mindmapRoots
      },
      indexes
    }
    return cache
  })
}
