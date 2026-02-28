import type { Atom, PrimitiveAtom } from 'jotai/vanilla'
import type {
  Document,
  Edge,
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import { createVisibleEdgesAtom } from './edges'
import { createIndexesAtom } from './indexes'
import {
  createCanvasNodesAtom,
  createMindmapRootsAtom,
  createOrderedNodesAtom,
  createVisibleNodesAtom
} from './nodes'
import { createSnapshotAtom } from './snapshot'

export type ReadAtoms = {
  document: PrimitiveAtom<Document>
  revision: PrimitiveAtom<number>
  orderedNodes: Atom<Node[]>
  visibleNodes: Atom<Node[]>
  canvasNodes: Atom<Node[]>
  visibleEdges: Atom<Edge[]>
  mindmapRoots: Atom<NodeId[]>
  indexes: Atom<ReadModelSnapshot['indexes']>
  snapshot: Atom<ReadModelSnapshot>
}

type CreateReadAtomsOptions = {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
}

export const createReadAtoms = ({
  documentAtom,
  revisionAtom
}: CreateReadAtomsOptions): ReadAtoms => {
  const orderedNodesAtom = createOrderedNodesAtom(documentAtom)
  const visibleNodesAtom = createVisibleNodesAtom(orderedNodesAtom)
  const canvasNodesAtom = createCanvasNodesAtom(visibleNodesAtom)
  const visibleEdgesAtom = createVisibleEdgesAtom(documentAtom, canvasNodesAtom)
  const mindmapRootsAtom = createMindmapRootsAtom(visibleNodesAtom)
  const indexesAtom = createIndexesAtom(visibleNodesAtom, canvasNodesAtom)

  return {
    document: documentAtom,
    revision: revisionAtom,
    orderedNodes: orderedNodesAtom,
    visibleNodes: visibleNodesAtom,
    canvasNodes: canvasNodesAtom,
    visibleEdges: visibleEdgesAtom,
    mindmapRoots: mindmapRootsAtom,
    indexes: indexesAtom,
    snapshot: createSnapshotAtom({
      documentAtom,
      revisionAtom,
      visibleNodesAtom,
      canvasNodesAtom,
      visibleEdgesAtom,
      mindmapRootsAtom,
      indexesAtom
    })
  }
}
