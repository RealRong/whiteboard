import type { Size } from '@engine-types/common'
import type { KernelReduceResult } from '@whiteboard/core/kernel'
import {
  getNodesBoundingRect,
  resolveContainerPadding
} from '@whiteboard/core/node'
import type {
  Document,
  Node,
  NodeId,
  Operation,
  Origin
} from '@whiteboard/core/types'
import {
  createGroupNormalizer
} from './normalize/group'

type Reduce = (
  document: Document,
  operations: readonly Operation[],
  origin: Origin
) => KernelReduceResult

type WriteNormalize = {
  reduce: (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ) => KernelReduceResult
}

const hasOwn = (target: object, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key)

const TEXT_WIDTH_MODE_KEY = 'widthMode'

const hasGeometryPatch = (
  patch: Extract<Operation, { type: 'node.update' }>['patch']
) => (
  hasOwn(patch, 'position')
  || hasOwn(patch, 'size')
  || hasOwn(patch, 'rotation')
)

const readGroupPadding = (
  node: Pick<Node, 'data'>
) => {
  const value = node.data?.padding
  return typeof value === 'number' ? value : undefined
}

const buildGroupContentRect = (
  document: Document,
  groupId: NodeId,
  nodeSize: Size
) => getNodesBoundingRect(
  Object.values(document.nodes.entities)
    .filter((node) => node.parentId === groupId),
  nodeSize
)

const isShallowEqual = (
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

const stripGroupRotationOperations = (
  document: Document,
  operations: readonly Operation[]
): Operation[] => {
  const next: Operation[] = []

  operations.forEach((operation) => {
    switch (operation.type) {
      case 'node.create': {
        if (operation.node.type !== 'group' || operation.node.rotation === undefined) {
          next.push(operation)
          return
        }

        const { rotation: _rotation, ...node } = operation.node
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

const buildFinalizeOperations = (
  document: Document,
  operations: readonly Operation[],
  nodeSize: Size
): Operation[] => {
  const next: Operation[] = []
  const handled = new Set<NodeId>()

  operations.forEach((operation) => {
    if (operation.type !== 'node.update') {
      return
    }
    if (!hasGeometryPatch(operation.patch)) {
      return
    }
    if (handled.has(operation.id)) {
      return
    }
    handled.add(operation.id)

    const node = document.nodes.entities[operation.id]
    if (!node) {
      return
    }

    let data = node.data

    if (node.type === 'text' && hasOwn(operation.patch, 'size')) {
      if (node.data?.[TEXT_WIDTH_MODE_KEY] !== 'fixed') {
        data = {
          ...(data ?? {}),
          [TEXT_WIDTH_MODE_KEY]: 'fixed'
        }
      }
    }

    if (
      node.type === 'group'
      && (
        hasOwn(operation.patch, 'position')
        || hasOwn(operation.patch, 'size')
      )
    ) {
      const nextData: Record<string, unknown> = {
        ...(data ?? {}),
        autoFit: 'manual'
      }
      const contentRect = buildGroupContentRect(
        document,
        node.id,
        nodeSize
      )

      if (contentRect) {
        const nextRect = {
          x: node.position.x,
          y: node.position.y,
          width: node.size?.width ?? nodeSize.width,
          height: node.size?.height ?? nodeSize.height
        }
        const padding = resolveContainerPadding({
          containerRect: nextRect,
          contentRect,
          currentPadding: readGroupPadding(node)
        })
        if (padding !== undefined) {
          nextData.padding = padding
        }
      }

      data = nextData
    }

    if (isShallowEqual(node.data, data)) {
      return
    }

    next.push({
      type: 'node.update',
      id: node.id,
      patch: {
        data
      }
    })
  })

  return next
}

export const createWriteNormalize = ({
  reduce,
  nodeSize,
  groupPadding
}: {
  reduce: Reduce
  nodeSize: Size
  groupPadding: number
}): WriteNormalize => {
  const normalizer = createGroupNormalizer({ nodeSize, groupPadding })

  const reduceWithNormalize = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => {
    const sanitizedOperations = stripGroupRotationOperations(document, operations)
    const planned = reduce(document, sanitizedOperations, origin)
    if (!planned.ok) return planned

    const finalizeOperations = buildFinalizeOperations(
      planned.doc,
      planned.changes.operations,
      nodeSize
    )
    const finalized = finalizeOperations.length > 0
      ? reduce(
          document,
          [...planned.changes.operations, ...finalizeOperations],
          origin
        )
      : planned
    if (!finalized.ok) {
      return finalized
    }

    if (!normalizer.shouldNormalize(finalized.changes.operations)) {
      return finalized
    }

    normalizer.ensure(document)
    const dirtyGroupIds = normalizer.analyze(
      finalized.doc,
      finalized.changes.operations
    )
    const normalizeOperations = normalizer.build(finalized.doc, dirtyGroupIds)
    if (!normalizeOperations.length) {
      return finalized
    }

    const reduced = reduce(
      document,
      [...finalized.changes.operations, ...normalizeOperations],
      origin
    )
    if (!reduced.ok) {
      normalizer.reset(document)
      return reduced
    }

    normalizer.sync(reduced.doc, normalizeOperations)
    return reduced
  }

  return {
    reduce: reduceWithNormalize
  }
}
