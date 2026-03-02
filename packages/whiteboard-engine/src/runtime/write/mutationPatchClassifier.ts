import type { EdgePatch, NodePatch } from '@whiteboard/core/types'
import type {
  EdgePatchClass,
  NodePatchClass
} from '@engine-types/write/mutation'

type PatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}

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
