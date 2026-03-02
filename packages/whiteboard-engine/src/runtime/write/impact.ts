import type {
  EdgeId,
  EdgePatch,
  NodeId,
  NodePatch,
  Operation
} from '@whiteboard/core/types'
import type {
  EdgePatchClass,
  MutationImpact,
  MutationImpactTag,
  NodePatchClass
} from '@engine-types/write/mutation'

type PatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}

const FULL_IMPACT_TAGS = new Set<MutationImpactTag>(['full'])

export const FULL_MUTATION_IMPACT: MutationImpact = {
  tags: FULL_IMPACT_TAGS
}

export const hasImpactTag = (
  impact: MutationImpact,
  tag: MutationImpactTag
) => impact.tags.has(tag)

const NODE_GEOMETRY_KEYS = new Set<keyof NodePatch>([
  'type',
  'position',
  'size',
  'rotation',
  'parentId'
])

const NODE_ORDER_KEYS = new Set<keyof NodePatch>([
  'layer',
  'zIndex'
])

const NODE_STYLE_KEYS = new Set<keyof NodePatch>([
  'locked',
  'data',
  'style'
])

const EDGE_GEOMETRY_KEYS = new Set<keyof EdgePatch>([
  'source',
  'target',
  'type',
  'routing'
])

const EDGE_ORDER_KEYS = new Set<keyof EdgePatch>([])

const EDGE_STYLE_KEYS = new Set<keyof EdgePatch>([
  'style',
  'label',
  'data'
])

const classifyPatch = <TKey extends string>(
  keys: readonly TKey[],
  geometryKeys: ReadonlySet<TKey>,
  orderKeys: ReadonlySet<TKey>,
  styleKeys: ReadonlySet<TKey>
): PatchClass => {
  if (!keys.length) {
    return {
      affectsGeometry: false,
      affectsOrder: false,
      affectsStyleOnly: false
    }
  }

  let affectsGeometry = false
  let affectsOrder = false
  let hasUnknownField = false

  keys.forEach((key) => {
    if (geometryKeys.has(key)) {
      affectsGeometry = true
      return
    }
    if (orderKeys.has(key)) {
      affectsOrder = true
      return
    }
    if (styleKeys.has(key)) return
    hasUnknownField = true
  })

  if (hasUnknownField) {
    affectsGeometry = true
  }

  return {
    affectsGeometry,
    affectsOrder,
    affectsStyleOnly: !affectsGeometry && !affectsOrder
  }
}

export const classifyNodePatch = (patch: NodePatch): NodePatchClass =>
  classifyPatch(
    Object.keys(patch) as Array<keyof NodePatch>,
    NODE_GEOMETRY_KEYS,
    NODE_ORDER_KEYS,
    NODE_STYLE_KEYS
  )

export const classifyEdgePatch = (patch: EdgePatch): EdgePatchClass =>
  classifyPatch(
    Object.keys(patch) as Array<keyof EdgePatch>,
    EDGE_GEOMETRY_KEYS,
    EDGE_ORDER_KEYS,
    EDGE_STYLE_KEYS
  )

const DEFAULT_MAX_OPERATIONS = 100
const DEFAULT_MAX_DIRTY_NODES = 200

const NODE_ORDER_TYPES = new Set<Operation['type']>([
  'node.order.set',
  'node.order.bringToFront',
  'node.order.sendToBack',
  'node.order.bringForward',
  'node.order.sendBackward'
])

const EDGE_ORDER_TYPES = new Set<Operation['type']>([
  'edge.order.set',
  'edge.order.bringToFront',
  'edge.order.sendToBack',
  'edge.order.bringForward',
  'edge.order.sendBackward'
])

const EMPTY_TAGS = new Set<MutationImpactTag>()
const FULL_TAGS = new Set<MutationImpactTag>(['full'])

export class MutationImpactAnalyzer {
  private readonly maxOperations: number
  private readonly maxDirtyNodes: number

  constructor({
    maxOperations = DEFAULT_MAX_OPERATIONS,
    maxDirtyNodes = DEFAULT_MAX_DIRTY_NODES
  }: {
    maxOperations?: number
    maxDirtyNodes?: number
  } = {}) {
    this.maxOperations = maxOperations
    this.maxDirtyNodes = maxDirtyNodes
  }

  analyze = (operations: readonly Operation[]): MutationImpact => {
    if (!operations.length) {
      return {
        tags: EMPTY_TAGS
      }
    }

    if (operations.length > this.maxOperations) {
      return this.fullImpact()
    }

    const tags = new Set<MutationImpactTag>()
    const dirtyNodeIds = new Set<NodeId>()
    const dirtyEdgeIds = new Set<EdgeId>()

    for (const operation of operations) {
      if (operation.type === 'node.create') {
        tags.add('nodes')
        tags.add('order')
        tags.add('geometry')
        dirtyNodeIds.add(operation.node.id)
        continue
      }

      if (operation.type === 'node.delete') {
        tags.add('nodes')
        tags.add('order')
        tags.add('geometry')
        dirtyNodeIds.add(operation.id)
        continue
      }

      if (operation.type === 'node.update') {
        tags.add('nodes')
        const patchClass = classifyNodePatch(operation.patch)
        if (patchClass.affectsOrder) {
          tags.add('order')
        }
        if (patchClass.affectsGeometry) {
          tags.add('geometry')
          dirtyNodeIds.add(operation.id)
        }
        continue
      }

      if (NODE_ORDER_TYPES.has(operation.type)) {
        tags.add('nodes')
        tags.add('order')
        continue
      }

      if (operation.type === 'edge.create') {
        tags.add('edges')
        tags.add('order')
        dirtyEdgeIds.add(operation.edge.id)
        continue
      }

      if (operation.type === 'edge.delete') {
        tags.add('edges')
        tags.add('order')
        dirtyEdgeIds.add(operation.id)
        continue
      }

      if (operation.type === 'edge.update') {
        tags.add('edges')
        const patchClass = classifyEdgePatch(operation.patch)
        if (patchClass.affectsOrder) {
          tags.add('order')
        }
        if (patchClass.affectsGeometry) {
          tags.add('geometry')
          dirtyEdgeIds.add(operation.id)
        }
        continue
      }

      if (EDGE_ORDER_TYPES.has(operation.type)) {
        tags.add('edges')
        tags.add('order')
        continue
      }

      if (operation.type === 'viewport.update') {
        tags.add('viewport')
        continue
      }

      if (operation.type.startsWith('mindmap.')) {
        tags.add('mindmap')
        tags.add('geometry')
        continue
      }

      return this.fullImpact()
    }

    if (dirtyNodeIds.size > this.maxDirtyNodes) {
      return this.fullImpact()
    }

    return {
      tags,
      dirtyNodeIds: dirtyNodeIds.size ? Array.from(dirtyNodeIds) : undefined,
      dirtyEdgeIds: dirtyEdgeIds.size ? Array.from(dirtyEdgeIds) : undefined
    }
  }

  private fullImpact = (): MutationImpact => ({
    tags: FULL_TAGS
  })
}
