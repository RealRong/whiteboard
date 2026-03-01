import type { Atom, PrimitiveAtom } from 'jotai/vanilla'
import type {
  Document,
  Edge,
  Node
} from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import {
  nodeSlices,
  orderedNodes,
  visibleNodes,
  canvasNodes
} from './nodes'
import { visibleEdges } from './edges'
import { indexes } from './indexes'
import { snapshot } from './snapshot'

type ReadOptions = {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
}

export type ReadAtoms = {
  document: PrimitiveAtom<Document>
  revision: PrimitiveAtom<number>
  orderedNodes: Atom<Node[]>
  visibleNodes: Atom<Node[]>
  canvasNodes: Atom<Node[]>
  visibleEdges: Atom<Edge[]>
  indexes: Atom<ReadModelSnapshot['indexes']>
  snapshot: Atom<ReadModelSnapshot>
}

export const read = ({
  documentAtom,
  revisionAtom
}: ReadOptions): ReadAtoms => {
  const nodeSlicesAtom = nodeSlices(documentAtom)
  const orderedNodesAtom = orderedNodes(nodeSlicesAtom)
  const visibleNodesAtom = visibleNodes(nodeSlicesAtom)
  const canvasNodesAtom = canvasNodes(nodeSlicesAtom)
  const visibleEdgesAtom = visibleEdges(documentAtom, canvasNodesAtom)
  const indexesAtom = indexes(nodeSlicesAtom)

  return {
    document: documentAtom,
    revision: revisionAtom,
    orderedNodes: orderedNodesAtom,
    visibleNodes: visibleNodesAtom,
    canvasNodes: canvasNodesAtom,
    visibleEdges: visibleEdgesAtom,
    indexes: indexesAtom,
    snapshot: snapshot({
      documentAtom,
      revisionAtom,
      visibleNodesAtom,
      canvasNodesAtom,
      visibleEdgesAtom,
      indexesAtom
    })
  }
}
