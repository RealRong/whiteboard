import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import { deriveCanvasNodes, deriveVisibleNodes } from '@whiteboard/core/node'
import type { Document, Node, NodeId } from '@whiteboard/core/types'
import { EMPTY_NODE_IDS, EMPTY_NODES, isSameIdOrder, isSameRefOrder, orderByIds } from './shared'

const deriveMindmapRoots = (visibleNodes: readonly Node[]): NodeId[] => {
  if (!visibleNodes.length) return EMPTY_NODE_IDS
  const roots = visibleNodes
    .filter((node) => node.type === 'mindmap')
    .map((node) => node.id)
  return roots.length ? roots : EMPTY_NODE_IDS
}

export const orderedNodes = (
  documentAtom: PrimitiveAtom<Document>
): Atom<Node[]> => {
  let previousNodesRef: Document['nodes'] | undefined
  let previousOrderRef: Document['order'] extends { nodes?: infer TOrder }
    ? TOrder
    : NodeId[] | undefined
  let orderedCache: Node[] = EMPTY_NODES

  return atom((get) => {
    const doc = get(documentAtom)
    const nodes = doc.nodes
    if (!nodes.length) {
      previousNodesRef = nodes
      previousOrderRef = doc.order?.nodes
      orderedCache = EMPTY_NODES
      return orderedCache
    }

    const orderRef = doc.order?.nodes
    if (nodes === previousNodesRef && orderRef === previousOrderRef) {
      return orderedCache
    }

    const order = orderRef ?? nodes.map((node) => node.id)
    const next = orderByIds(nodes, order)
    if (!isSameRefOrder(orderedCache, next)) {
      orderedCache = next
    }

    previousNodesRef = nodes
    previousOrderRef = orderRef
    return orderedCache
  })
}

export const visibleNodes = (orderedNodesAtom: Atom<Node[]>): Atom<Node[]> => {
  let orderedNodesRef: Node[] | undefined
  let visibleCache: Node[] = EMPTY_NODES

  return atom((get) => {
    const orderedNodes = get(orderedNodesAtom)
    if (orderedNodes === orderedNodesRef) {
      return visibleCache
    }

    const next = deriveVisibleNodes(orderedNodes)
    const normalized = next.length ? next : EMPTY_NODES
    if (!isSameRefOrder(visibleCache, normalized)) {
      visibleCache = normalized
    }

    orderedNodesRef = orderedNodes
    return visibleCache
  })
}

export const canvasNodes = (visibleNodesAtom: Atom<Node[]>): Atom<Node[]> => {
  let visibleNodesRef: Node[] | undefined
  let canvasCache: Node[] = EMPTY_NODES

  return atom((get) => {
    const visibleNodes = get(visibleNodesAtom)
    if (visibleNodes === visibleNodesRef) {
      return canvasCache
    }

    const next = deriveCanvasNodes(visibleNodes)
    const normalized = next.length ? next : EMPTY_NODES
    if (!isSameRefOrder(canvasCache, normalized)) {
      canvasCache = normalized
    }

    visibleNodesRef = visibleNodes
    return canvasCache
  })
}

export const mindmapRoots = (visibleNodesAtom: Atom<Node[]>): Atom<NodeId[]> => {
  let visibleNodesRef: Node[] | undefined
  let rootsCache: NodeId[] = EMPTY_NODE_IDS

  return atom((get) => {
    const visibleNodes = get(visibleNodesAtom)
    if (visibleNodes === visibleNodesRef) {
      return rootsCache
    }

    const nextRoots = deriveMindmapRoots(visibleNodes)
    if (!isSameIdOrder(rootsCache, nextRoots)) {
      rootsCache = nextRoots
    }

    visibleNodesRef = visibleNodes
    return rootsCache
  })
}
