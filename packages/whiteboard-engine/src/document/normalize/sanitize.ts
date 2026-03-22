import type {
  Document,
  Node,
  Operation
} from '@whiteboard/core/types'

const hasOwn = (target: object, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key)

const stripGroupRotationFromNode = (
  node: Node
) => {
  if (node.type !== 'group' || node.rotation === undefined) {
    return node
  }

  const { rotation: _rotation, ...nextNode } = node
  return nextNode
}

export const sanitizeDocument = (
  document: Document
): Document => {
  let changed = false
  const entities: Record<string, Node> = {}

  Object.entries(document.nodes.entities).forEach(([id, node]) => {
    const nextNode = stripGroupRotationFromNode(node)
    entities[id] = nextNode
    if (nextNode !== node) {
      changed = true
    }
  })

  return changed
    ? {
        ...document,
        nodes: {
          ...document.nodes,
          entities
        }
      }
    : document
}

export const sanitizeOperations = ({
  document,
  operations
}: {
  document: Document
  operations: readonly Operation[]
}): Operation[] => {
  const next: Operation[] = []

  operations.forEach((operation) => {
    switch (operation.type) {
      case 'node.create': {
        const node = stripGroupRotationFromNode(operation.node)
        if (node === operation.node) {
          next.push(operation)
          return
        }

        next.push({
          ...operation,
          node
        })
        return
      }
      case 'node.update': {
        if (!hasOwn(operation.patch, 'rotation')) {
          next.push(operation)
          return
        }

        const current = document.nodes.entities[operation.id]
        const nextType = operation.patch.type ?? current?.type
        if (nextType !== 'group') {
          next.push(operation)
          return
        }

        const { rotation: _rotation, ...patch } = operation.patch
        if (!Object.keys(patch).length) {
          return
        }
        next.push({
          ...operation,
          patch
        })
        return
      }
      default:
        next.push(operation)
    }
  })

  return next
}
