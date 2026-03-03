import type { ChangeSet, DispatchFailure, DispatchResult, Origin } from '../types/core'
import type { ChangeHandlers, TransactionContext } from './changes'
import type { EventBus } from './events'
import type { CoreState } from './state'
import { getMindmapTreeFromNode, withMindmapTree } from '../mindmap/helpers'

type CreateFailure = (reason: DispatchFailure['reason'], message?: string) => DispatchResult

type ApplyDependencies = {
  state: CoreState
  changeHandlers: ChangeHandlers
  eventBus: EventBus
  transactionStack: TransactionContext[]
  createChangeSet: (operations: ChangeSet['operations'], origin?: Origin) => ChangeSet
  runBeforeHandlers: (handlers: ChangeHandlers, changes: ChangeSet) => boolean
  runAfterHandlers: (handlers: ChangeHandlers, changes: ChangeSet) => void
  createFailure: CreateFailure
}

export const createApplyOperations = ({
  state,
  changeHandlers,
  eventBus,
  transactionStack,
  createChangeSet,
  runBeforeHandlers,
  runAfterHandlers,
  createFailure
}: ApplyDependencies) => {
  const { maps, touchDocument, applyDocument, cloneMindmapTree, cloneNode } = state

  const getMindmapNode = (document: CoreState['document'], id: string) =>
    document.nodes.find((node) => node.id === id && node.type === 'mindmap')

  const readMindmapTree = (document: CoreState['document'], id: string) => {
    const node = getMindmapNode(document, id)
    return getMindmapTreeFromNode(node)
  }

  const writeMindmapTree = (node: CoreState['document']['nodes'][number], tree: ReturnType<typeof cloneMindmapTree>) => {
    const normalized = tree.id === node.id ? tree : { ...tree, id: node.id }
    node.data = {
      ...(node.data && typeof node.data === 'object' ? (node.data as Record<string, unknown>) : {}),
      mindmap: normalized
    }
    maps.mindmaps.set(node.id, cloneMindmapTree(normalized))
    maps.nodes.set(node.id, cloneNode(withMindmapTree(node, cloneMindmapTree(normalized))))
  }

  const ensureChildren = (tree: { children: Record<string, string[]> }, id: string) => {
    if (!tree.children[id]) {
      tree.children[id] = []
    }
    return tree.children[id]
  }

  const removeChild = (tree: { children: Record<string, string[]> }, parentId: string, nodeId: string) => {
    const list = tree.children[parentId]
    if (!list) return -1
    const index = list.indexOf(nodeId)
    if (index >= 0) {
      list.splice(index, 1)
    }
    return index
  }

  const moveToFront = <T extends string>(order: T[], ids: readonly T[]) => {
    const set = new Set(ids)
    const kept = order.filter((id) => !set.has(id))
    const moved = order.filter((id) => set.has(id))
    return [...kept, ...moved]
  }

  const moveToBack = <T extends string>(order: T[], ids: readonly T[]) => {
    const set = new Set(ids)
    const kept = order.filter((id) => !set.has(id))
    const moved = order.filter((id) => set.has(id))
    return [...moved, ...kept]
  }

  const moveForward = <T extends string>(order: T[], ids: readonly T[]) => {
    const set = new Set(ids)
    const next = [...order]
    for (let i = next.length - 2; i >= 0; i -= 1) {
      const current = next[i]
      const after = next[i + 1]
      if (set.has(current) && !set.has(after)) {
        next[i] = after
        next[i + 1] = current
      }
    }
    return next
  }

  const moveBackward = <T extends string>(order: T[], ids: readonly T[]) => {
    const set = new Set(ids)
    const next = [...order]
    for (let i = 1; i < next.length; i += 1) {
      const current = next[i]
      const before = next[i - 1]
      if (set.has(current) && !set.has(before)) {
        next[i - 1] = current
        next[i] = before
      }
    }
    return next
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

  const applyOperation = (op: ChangeSet['operations'][number], document: CoreState['document']) => {
    switch (op.type) {
      case 'node.create': {
        maps.nodes.set(op.node.id, op.node)
        document.nodes.push(op.node)
        appendOrderId(document.order.nodes, op.node.id)
        const tree = getMindmapTreeFromNode(op.node)
        if (tree) {
          maps.mindmaps.set(op.node.id, cloneMindmapTree(tree.id === op.node.id ? tree : { ...tree, id: op.node.id }))
        }
        break
      }
      case 'node.update': {
        const current = maps.nodes.get(op.id)
        if (!current) break
        const updated = { ...current, ...op.patch }
        maps.nodes.set(op.id, updated)
        const index = document.nodes.findIndex((node) => node.id === op.id)
        if (index >= 0) {
          document.nodes[index] = updated
        }
        const tree = getMindmapTreeFromNode(updated)
        if (tree) {
          maps.mindmaps.set(op.id, cloneMindmapTree(tree.id === op.id ? tree : { ...tree, id: op.id }))
        } else {
          maps.mindmaps.delete(op.id)
        }
        break
      }
      case 'node.delete': {
        maps.nodes.delete(op.id)
        maps.mindmaps.delete(op.id)
        const index = document.nodes.findIndex((node) => node.id === op.id)
        if (index >= 0) {
          document.nodes.splice(index, 1)
        }
        removeOrderId(document.order.nodes, op.id)
        break
      }
      case 'node.order.set': {
        document.order.nodes = [...op.ids]
        break
      }
      case 'node.order.bringToFront': {
        document.order.nodes = moveToFront(document.order.nodes, op.ids)
        break
      }
      case 'node.order.sendToBack': {
        document.order.nodes = moveToBack(document.order.nodes, op.ids)
        break
      }
      case 'node.order.bringForward': {
        document.order.nodes = moveForward(document.order.nodes, op.ids)
        break
      }
      case 'node.order.sendBackward': {
        document.order.nodes = moveBackward(document.order.nodes, op.ids)
        break
      }
      case 'edge.create': {
        maps.edges.set(op.edge.id, op.edge)
        document.edges.push(op.edge)
        appendOrderId(document.order.edges, op.edge.id)
        break
      }
      case 'edge.update': {
        const current = maps.edges.get(op.id)
        if (!current) break
        const updated = { ...current, ...op.patch }
        maps.edges.set(op.id, updated)
        const index = document.edges.findIndex((edge) => edge.id === op.id)
        if (index >= 0) {
          document.edges[index] = updated
        }
        break
      }
      case 'edge.delete': {
        maps.edges.delete(op.id)
        const index = document.edges.findIndex((edge) => edge.id === op.id)
        if (index >= 0) {
          document.edges.splice(index, 1)
        }
        removeOrderId(document.order.edges, op.id)
        break
      }
      case 'edge.order.set': {
        document.order.edges = [...op.ids]
        break
      }
      case 'edge.order.bringToFront': {
        document.order.edges = moveToFront(document.order.edges, op.ids)
        break
      }
      case 'edge.order.sendToBack': {
        document.order.edges = moveToBack(document.order.edges, op.ids)
        break
      }
      case 'edge.order.bringForward': {
        document.order.edges = moveForward(document.order.edges, op.ids)
        break
      }
      case 'edge.order.sendBackward': {
        document.order.edges = moveBackward(document.order.edges, op.ids)
        break
      }
      case 'mindmap.create': {
        const existingIndex = document.nodes.findIndex((node) => node.id === op.mindmap.id)
        const position = op.mindmap.meta?.position ?? { x: 0, y: 0 }
        if (existingIndex < 0) {
          const nextNode = {
            id: op.mindmap.id,
            type: 'mindmap' as const,
            position,
            data: { mindmap: op.mindmap }
          }
          document.nodes.push(nextNode)
          maps.nodes.set(nextNode.id, cloneNode(nextNode))
          appendOrderId(document.order.nodes, nextNode.id)
        } else {
          const node = document.nodes[existingIndex]
          if (node.type === 'mindmap') {
            if (!node.position) {
              node.position = position
            }
            writeMindmapTree(node, cloneMindmapTree(op.mindmap))
          }
        }
        maps.mindmaps.set(op.mindmap.id, cloneMindmapTree(op.mindmap))
        break
      }
      case 'mindmap.replace': {
        const node = getMindmapNode(document, op.id)
        if (!node) break
        writeMindmapTree(node, cloneMindmapTree(op.after))
        break
      }
      case 'mindmap.delete': {
        maps.mindmaps.delete(op.id)
        maps.nodes.delete(op.id)
        const index = document.nodes.findIndex((node) => node.id === op.id)
        if (index >= 0) {
          document.nodes.splice(index, 1)
        }
        removeOrderId(document.order.nodes, op.id)
        break
      }
      case 'mindmap.node.create': {
        const tree = readMindmapTree(document, op.id)
        if (!tree) break
        tree.nodes[op.node.id] = op.node
        ensureChildren(tree, op.node.id)
        const children = ensureChildren(tree, op.parentId)
        if (op.index === undefined || op.index < 0 || op.index > children.length) {
          children.push(op.node.id)
        } else {
          children.splice(op.index, 0, op.node.id)
        }
        const node = getMindmapNode(document, op.id)
        if (node) {
          writeMindmapTree(node, cloneMindmapTree(tree))
        }
        break
      }
      case 'mindmap.node.update': {
        const tree = readMindmapTree(document, op.id)
        if (!tree) break
        const current = tree.nodes[op.nodeId]
        if (!current) break
        tree.nodes[op.nodeId] = { ...current, ...op.patch }
        const node = getMindmapNode(document, op.id)
        if (node) {
          writeMindmapTree(node, cloneMindmapTree(tree))
        }
        break
      }
      case 'mindmap.node.delete': {
        const tree = readMindmapTree(document, op.id)
        if (!tree) break
        if (op.parentId) {
          removeChild(tree, op.parentId, op.nodeId)
        }
        Object.keys(op.subtree.nodes).forEach((nodeId) => {
          delete tree.nodes[nodeId]
          delete tree.children[nodeId]
        })
        const node = getMindmapNode(document, op.id)
        if (node) {
          writeMindmapTree(node, cloneMindmapTree(tree))
        }
        break
      }
      case 'mindmap.node.move': {
        const tree = readMindmapTree(document, op.id)
        if (!tree) break
        removeChild(tree, op.fromParentId, op.nodeId)
        const target = ensureChildren(tree, op.toParentId)
        if (op.toIndex < 0 || op.toIndex > target.length) {
          target.push(op.nodeId)
        } else {
          target.splice(op.toIndex, 0, op.nodeId)
        }
        const movedNode = tree.nodes[op.nodeId]
        if (movedNode) {
          movedNode.parentId = op.toParentId
          if (op.toParentId === tree.rootId) {
            movedNode.side = op.side ?? movedNode.side ?? 'right'
          } else if (movedNode.side) {
            delete movedNode.side
          }
        }
        const mindmapNode = getMindmapNode(document, op.id)
        if (mindmapNode) {
          writeMindmapTree(mindmapNode, cloneMindmapTree(tree))
        }
        break
      }
      case 'mindmap.node.reorder': {
        const tree = readMindmapTree(document, op.id)
        if (!tree) break
        const list = tree.children[op.parentId]
        if (!list) break
        if (op.fromIndex < 0 || op.fromIndex >= list.length || op.toIndex < 0 || op.toIndex >= list.length) break
        const [moved] = list.splice(op.fromIndex, 1)
        list.splice(op.toIndex, 0, moved)
        const node = getMindmapNode(document, op.id)
        if (node) {
          writeMindmapTree(node, cloneMindmapTree(tree))
        }
        break
      }
      case 'viewport.update': {
        document.viewport = {
          center: { x: op.after.center.x, y: op.after.center.y },
          zoom: op.after.zoom
        }
        break
      }
      default:
        break
    }
  }

  const commitChangeSet = (changes: ChangeSet): DispatchResult => {
    if (changes.operations.length === 0) {
      return createFailure('invalid', 'No operations to apply.')
    }
    if (runBeforeHandlers(changeHandlers, changes)) {
      return createFailure('cancelled')
    }
    applyDocument((draft) => {
      changes.operations.forEach((op) => applyOperation(op, draft))
      touchDocument(draft, changes.timestamp)
    })
    runAfterHandlers(changeHandlers, changes)
    eventBus.emitChangesApplied(changes)
    const currentTransaction = transactionStack[transactionStack.length - 1]
    if (currentTransaction) {
      currentTransaction.changes.push(changes)
    }
    return { ok: true, changes }
  }

  const applyOperations = (operations: ChangeSet['operations'], origin?: Origin): DispatchResult =>
    commitChangeSet(createChangeSet(operations, origin))

  const applyChangeSet = (changes: ChangeSet): DispatchResult =>
    commitChangeSet(changes)

  return {
    applyOperations,
    applyChangeSet
  }
}
