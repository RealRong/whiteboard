import type { Operation } from '../../types'

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export const invertOperation = (operation: Operation): Operation[] | null => {
  switch (operation.type) {
    case 'node.create': {
      return [
        {
          type: 'node.delete',
          id: operation.node.id,
          before: cloneValue(operation.node)
        }
      ]
    }
    case 'node.update': {
      if (!operation.before) return null
      return [
        {
          type: 'node.update',
          id: operation.id,
          patch: cloneValue(operation.before) as any
        }
      ]
    }
    case 'node.delete': {
      if (!operation.before) return null
      return [
        {
          type: 'node.create',
          node: cloneValue(operation.before)
        }
      ]
    }
    case 'node.order.set':
    case 'node.order.bringToFront':
    case 'node.order.sendToBack':
    case 'node.order.bringForward':
    case 'node.order.sendBackward': {
      if (!operation.before) return null
      return [
        {
          type: 'node.order.set',
          ids: [...operation.before]
        }
      ]
    }
    case 'edge.create': {
      return [
        {
          type: 'edge.delete',
          id: operation.edge.id,
          before: cloneValue(operation.edge)
        }
      ]
    }
    case 'edge.update': {
      if (!operation.before) return null
      return [
        {
          type: 'edge.update',
          id: operation.id,
          patch: cloneValue(operation.before) as any
        }
      ]
    }
    case 'edge.delete': {
      if (!operation.before) return null
      return [
        {
          type: 'edge.create',
          edge: cloneValue(operation.before)
        }
      ]
    }
    case 'edge.order.set':
    case 'edge.order.bringToFront':
    case 'edge.order.sendToBack':
    case 'edge.order.bringForward':
    case 'edge.order.sendBackward': {
      if (!operation.before) return null
      return [
        {
          type: 'edge.order.set',
          ids: [...operation.before]
        }
      ]
    }
    case 'mindmap.create': {
      return [
        {
          type: 'mindmap.delete',
          id: operation.mindmap.id,
          before: cloneValue(operation.mindmap)
        }
      ]
    }
    case 'mindmap.replace': {
      if (!operation.before) return null
      return [
        {
          type: 'mindmap.replace',
          id: operation.id,
          before: cloneValue(operation.after),
          after: cloneValue(operation.before)
        }
      ]
    }
    case 'mindmap.delete': {
      if (!operation.before) return null
      return [
        {
          type: 'mindmap.create',
          mindmap: cloneValue(operation.before)
        }
      ]
    }
    case 'mindmap.node.create': {
      return [
        {
          type: 'mindmap.node.delete',
          id: operation.id,
          nodeId: operation.node.id,
          parentId: operation.parentId,
          index: operation.index,
          subtree: {
            nodes: {
              [operation.node.id]: cloneValue(operation.node)
            },
            children: {
              [operation.node.id]: []
            }
          }
        }
      ]
    }
    case 'mindmap.node.update': {
      if (!operation.before) return null
      return [
        {
          type: 'mindmap.node.update',
          id: operation.id,
          nodeId: operation.nodeId,
          patch: cloneValue(operation.before)
        }
      ]
    }
    case 'mindmap.node.delete': {
      if (!operation.parentId) return null
      const queue: string[] = [operation.nodeId]
      const createOps: Operation[] = []
      while (queue.length) {
        const nodeId = queue.shift() as string
        const node = operation.subtree.nodes[nodeId]
        if (!node) continue
        const parentId = nodeId === operation.nodeId ? operation.parentId : node.parentId
        if (!parentId) return null

        const parentChildren = operation.subtree.children[parentId] ?? []
        const childIndex = parentChildren.indexOf(nodeId)
        const index =
          nodeId === operation.nodeId
            ? operation.index
            : childIndex >= 0
              ? childIndex
              : undefined

        createOps.push({
          type: 'mindmap.node.create',
          id: operation.id,
          node: cloneValue(node),
          parentId,
          index
        })

        const children = operation.subtree.children[nodeId] ?? []
        queue.push(...children)
      }
      return createOps
    }
    case 'mindmap.node.move': {
      return [
        {
          type: 'mindmap.node.move',
          id: operation.id,
          nodeId: operation.nodeId,
          fromParentId: operation.toParentId,
          toParentId: operation.fromParentId,
          fromIndex: operation.toIndex,
          toIndex: operation.fromIndex,
          side: operation.fromSide
        }
      ]
    }
    case 'mindmap.node.reorder': {
      return [
        {
          type: 'mindmap.node.reorder',
          id: operation.id,
          parentId: operation.parentId,
          fromIndex: operation.toIndex,
          toIndex: operation.fromIndex
        }
      ]
    }
    case 'viewport.update': {
      if (!operation.before) return null
      return [
        {
          type: 'viewport.update',
          before: cloneValue(operation.after),
          after: cloneValue(operation.before)
        }
      ]
    }
    default:
      return null
  }
}

export const buildInverseOperations = (
  operations: Operation[]
): { ok: true; operations: Operation[] } | { ok: false } => {
  const inverse: Operation[] = []
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index]
    const next = invertOperation(operation)
    if (!next) return { ok: false }
    inverse.push(...next)
  }
  return { ok: true, operations: inverse }
}
