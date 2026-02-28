import type { Atom, PrimitiveAtom } from 'jotai/vanilla'
import type {
  Document,
  Edge,
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import { visibleEdges } from './edges'
import { indexes } from './indexes'
import {
  canvasNodes,
  mindmapRoots,
  orderedNodes,
  visibleNodes
} from './nodes'
import { snapshot } from './snapshot'

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

type ReadOptions = {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
}

export const read = ({
  documentAtom,
  revisionAtom
}: ReadOptions): ReadAtoms => {
  const orderedNodesAtom = orderedNodes(documentAtom)
  const visibleNodesAtom = visibleNodes(orderedNodesAtom)
  const canvasNodesAtom = canvasNodes(visibleNodesAtom)
  const visibleEdgesAtom = visibleEdges(documentAtom, canvasNodesAtom)
  const mindmapRootsAtom = mindmapRoots(visibleNodesAtom)
  const indexesAtom = indexes(visibleNodesAtom, canvasNodesAtom)

  return {
    document: documentAtom,
    revision: revisionAtom,
    orderedNodes: orderedNodesAtom,
    visibleNodes: visibleNodesAtom,
    canvasNodes: canvasNodesAtom,
    visibleEdges: visibleEdgesAtom,
    mindmapRoots: mindmapRootsAtom,
    indexes: indexesAtom,
    snapshot: snapshot({
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
