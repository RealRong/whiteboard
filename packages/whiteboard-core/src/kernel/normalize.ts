import type {
  Document,
  Edge,
  EdgeId,
  MindmapTree,
  Node,
  NodeId,
  Operation,
  Viewport
} from '../types'
import {
  bringOrderForward,
  bringOrderToFront,
  sendOrderBackward,
  sendOrderToBack
} from '../utils'

type NormalizeState = {
  nodeById: Map<NodeId, Node>
  edgeById: Map<EdgeId, Edge>
  nodeOrder: NodeId[]
  edgeOrder: EdgeId[]
  mindmapById: Map<string, MindmapTree>
  viewport?: Viewport
}

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) return clone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

const appendOrderId = <T extends string>(order: T[], id: T) => {
  if (!order.includes(id)) {
    order.push(id)
  }
}

const removeOrderId = <T extends string>(order: T[], id: T) => {
  const index = order.indexOf(id)
  if (index >= 0) {
    order.splice(index, 1)
  }
}

const ensureChildren = (
  tree: MindmapTree,
  nodeId: string
) => {
  if (!tree.children[nodeId]) {
    tree.children[nodeId] = []
  }
  return tree.children[nodeId]
}

const initState = (document: Document): NormalizeState => ({
  nodeById: new Map(document.nodes.map((node) => [node.id, cloneValue(node)])),
  edgeById: new Map(document.edges.map((edge) => [edge.id, cloneValue(edge)])),
  nodeOrder: [...document.order.nodes],
  edgeOrder: [...document.order.edges],
  mindmapById: new Map((document.mindmaps ?? []).map((tree) => [tree.id, cloneValue(tree)])),
  viewport: document.viewport ? cloneValue(document.viewport) : undefined
})

export const normalizeOperations = (
  document: Document,
  operations: readonly Operation[]
): Operation[] => {
  const state = initState(document)
  const normalized: Operation[] = []

  for (const operation of operations) {
    let nextOperation: Operation = operation

    switch (operation.type) {
      case 'node.create': {
        state.nodeById.set(operation.node.id, cloneValue(operation.node))
        appendOrderId(state.nodeOrder, operation.node.id)
        break
      }
      case 'node.update': {
        const current = state.nodeById.get(operation.id)
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        if (current) {
          state.nodeById.set(operation.id, {
            ...current,
            ...operation.patch
          })
        }
        break
      }
      case 'node.delete': {
        const current = state.nodeById.get(operation.id)
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        state.nodeById.delete(operation.id)
        removeOrderId(state.nodeOrder, operation.id)
        break
      }
      case 'node.order.set': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.nodeOrder]
          }
        }
        state.nodeOrder = [...operation.ids]
        break
      }
      case 'node.order.bringToFront': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.nodeOrder]
          }
        }
        state.nodeOrder = bringOrderToFront(state.nodeOrder, [...operation.ids])
        break
      }
      case 'node.order.sendToBack': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.nodeOrder]
          }
        }
        state.nodeOrder = sendOrderToBack(state.nodeOrder, [...operation.ids])
        break
      }
      case 'node.order.bringForward': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.nodeOrder]
          }
        }
        state.nodeOrder = bringOrderForward(state.nodeOrder, [...operation.ids])
        break
      }
      case 'node.order.sendBackward': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.nodeOrder]
          }
        }
        state.nodeOrder = sendOrderBackward(state.nodeOrder, [...operation.ids])
        break
      }
      case 'edge.create': {
        state.edgeById.set(operation.edge.id, cloneValue(operation.edge))
        appendOrderId(state.edgeOrder, operation.edge.id)
        break
      }
      case 'edge.update': {
        const current = state.edgeById.get(operation.id)
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        if (current) {
          state.edgeById.set(operation.id, {
            ...current,
            ...operation.patch
          })
        }
        break
      }
      case 'edge.delete': {
        const current = state.edgeById.get(operation.id)
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        state.edgeById.delete(operation.id)
        removeOrderId(state.edgeOrder, operation.id)
        break
      }
      case 'edge.order.set': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.edgeOrder]
          }
        }
        state.edgeOrder = [...operation.ids]
        break
      }
      case 'edge.order.bringToFront': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.edgeOrder]
          }
        }
        state.edgeOrder = bringOrderToFront(state.edgeOrder, [...operation.ids])
        break
      }
      case 'edge.order.sendToBack': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.edgeOrder]
          }
        }
        state.edgeOrder = sendOrderToBack(state.edgeOrder, [...operation.ids])
        break
      }
      case 'edge.order.bringForward': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.edgeOrder]
          }
        }
        state.edgeOrder = bringOrderForward(state.edgeOrder, [...operation.ids])
        break
      }
      case 'edge.order.sendBackward': {
        if (!operation.before) {
          nextOperation = {
            ...operation,
            before: [...state.edgeOrder]
          }
        }
        state.edgeOrder = sendOrderBackward(state.edgeOrder, [...operation.ids])
        break
      }
      case 'mindmap.create': {
        state.mindmapById.set(operation.mindmap.id, cloneValue(operation.mindmap))
        break
      }
      case 'mindmap.replace': {
        const current = state.mindmapById.get(operation.id)
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        state.mindmapById.set(operation.id, cloneValue(operation.after))
        break
      }
      case 'mindmap.delete': {
        const current = state.mindmapById.get(operation.id)
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        state.mindmapById.delete(operation.id)
        break
      }
      case 'mindmap.node.create': {
        const tree = state.mindmapById.get(operation.id)
        if (tree) {
          tree.nodes[operation.node.id] = cloneValue(operation.node)
          ensureChildren(tree, operation.node.id)
          const children = ensureChildren(tree, operation.parentId)
          if (
            typeof operation.index === 'number' &&
            operation.index >= 0 &&
            operation.index <= children.length
          ) {
            children.splice(operation.index, 0, operation.node.id)
          } else {
            children.push(operation.node.id)
          }
        }
        break
      }
      case 'mindmap.node.update': {
        const tree = state.mindmapById.get(operation.id)
        const current = tree?.nodes[operation.nodeId]
        if (!operation.before && current) {
          nextOperation = {
            ...operation,
            before: cloneValue(current)
          }
        }
        if (tree && current) {
          tree.nodes[operation.nodeId] = {
            ...current,
            ...operation.patch
          }
        }
        break
      }
      case 'mindmap.node.delete': {
        const tree = state.mindmapById.get(operation.id)
        if (tree) {
          if (operation.parentId) {
            const siblings = tree.children[operation.parentId] ?? []
            const index = siblings.indexOf(operation.nodeId)
            if (index >= 0) siblings.splice(index, 1)
          }
          Object.keys(operation.subtree.nodes).forEach((nodeId) => {
            delete tree.nodes[nodeId]
            delete tree.children[nodeId]
          })
        }
        break
      }
      case 'mindmap.node.move': {
        const tree = state.mindmapById.get(operation.id)
        if (tree) {
          const fromChildren = tree.children[operation.fromParentId] ?? []
          const fromIndex = fromChildren.indexOf(operation.nodeId)
          if (fromIndex >= 0) fromChildren.splice(fromIndex, 1)
          const toChildren = ensureChildren(tree, operation.toParentId)
          if (operation.toIndex >= 0 && operation.toIndex <= toChildren.length) {
            toChildren.splice(operation.toIndex, 0, operation.nodeId)
          } else {
            toChildren.push(operation.nodeId)
          }
          const moved = tree.nodes[operation.nodeId]
          if (moved) {
            moved.parentId = operation.toParentId
          }
        }
        break
      }
      case 'mindmap.node.reorder': {
        const tree = state.mindmapById.get(operation.id)
        const siblings = tree?.children[operation.parentId]
        if (!siblings) break
        if (
          operation.fromIndex < 0 ||
          operation.fromIndex >= siblings.length ||
          operation.toIndex < 0 ||
          operation.toIndex >= siblings.length
        ) {
          break
        }
        const [moved] = siblings.splice(operation.fromIndex, 1)
        siblings.splice(operation.toIndex, 0, moved)
        break
      }
      case 'viewport.update': {
        if (!operation.before && state.viewport) {
          nextOperation = {
            ...operation,
            before: cloneValue(state.viewport)
          }
        }
        state.viewport = cloneValue(operation.after)
        break
      }
      default:
        break
    }

    normalized.push(nextOperation)
  }

  return normalized
}
