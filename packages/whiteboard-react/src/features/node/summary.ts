import type { Node, NodeId } from '@whiteboard/core/types'
import type { ControlId, NodeFamily, NodeMeta } from '../../types/node'

export type NodeTypeSummary = {
  type: string
  name: string
  family: NodeFamily
  icon: string
  count: number
}

export type NodeSummary = {
  ids: readonly NodeId[]
  count: number
  hasGroup: boolean
  lock: 'none' | 'mixed' | 'all'
  types: readonly NodeTypeSummary[]
  mixed: boolean
}

export type NodeSelectionCan = {
  fill: boolean
  stroke: boolean
  text: boolean
  group: boolean
  align: boolean
  distribute: boolean
  makeGroup: boolean
  ungroup: boolean
  order: boolean
  filter: boolean
  lock: boolean
  copy: boolean
  cut: boolean
  duplicate: boolean
  delete: boolean
}

const EMPTY_IDS: readonly NodeId[] = []
const EMPTY_TYPES: readonly NodeTypeSummary[] = []
const EMPTY_CONTROLS: readonly ControlId[] = []
const EMPTY_CAN: NodeSelectionCan = {
  fill: false,
  stroke: false,
  text: false,
  group: false,
  align: false,
  distribute: false,
  makeGroup: false,
  ungroup: false,
  order: false,
  filter: false,
  lock: false,
  copy: false,
  cut: false,
  duplicate: false,
  delete: false
}

const readTypeMeta = (
  type: string,
  resolveMeta?: (type: string) => NodeMeta | undefined
) => resolveMeta?.(type) ?? {
  name: type,
  family: 'shape' as const,
  icon: type,
  controls: EMPTY_CONTROLS
}

export const summarizeNodes = (
  nodes: readonly Node[],
  options?: {
    resolveMeta?: (type: string) => NodeMeta | undefined
  }
): NodeSummary => {
  const ids = nodes.length > 0 ? nodes.map((node) => node.id) : EMPTY_IDS
  const count = ids.length
  const hasGroup = nodes.some((node) => node.type === 'group')
  const lockedCount = nodes.reduce(
    (total, node) => total + (node.locked ? 1 : 0),
    0
  )
  const typeCountByType = new Map<string, number>()

  nodes.forEach((node) => {
    typeCountByType.set(
      node.type,
      (typeCountByType.get(node.type) ?? 0) + 1
    )
  })

  const types = typeCountByType.size > 0
    ? [...typeCountByType.entries()]
      .map(([type, typeCount]) => {
        const meta = readTypeMeta(type, options?.resolveMeta)

        return {
          type,
          name: meta.name,
          family: meta.family,
          icon: meta.icon,
          count: typeCount
        }
      })
      .sort((left, right) => (
        right.count - left.count || left.name.localeCompare(right.name)
      ))
    : EMPTY_TYPES

  return {
    ids,
    count,
    hasGroup,
    lock:
      count === 0
        ? 'none'
        : lockedCount === count
          ? 'all'
          : lockedCount === 0
            ? 'none'
            : 'mixed',
    types,
    mixed: types.length > 1
  }
}

const hasControl = (
  meta: NodeMeta,
  control: ControlId
) => meta.controls.includes(control)

export const resolveNodeSelectionCan = (
  nodes: readonly Node[],
  options?: {
    resolveMeta?: (type: string) => NodeMeta | undefined
  }
): NodeSelectionCan => {
  const count = nodes.length

  if (!count) {
    return EMPTY_CAN
  }

  const metas = nodes.map((node) => readTypeMeta(node.type, options?.resolveMeta))
  const hasShared = (control: ControlId) => metas.every((meta) => hasControl(meta, control))
  const mixedTypes = new Set(nodes.map((node) => node.type)).size > 1

  return {
    fill: hasShared('fill'),
    stroke: hasShared('stroke'),
    text: count === 1 && hasShared('text'),
    group: count === 1 && hasShared('group'),
    align: count >= 2,
    distribute: count >= 3,
    makeGroup: count >= 2,
    ungroup: nodes.some((node) => node.type === 'group'),
    order: true,
    filter: mixedTypes,
    lock: true,
    copy: true,
    cut: true,
    duplicate: true,
    delete: true
  }
}

export const isNodeSelectionCanEqual = (
  left: NodeSelectionCan,
  right: NodeSelectionCan
) => (
  left.fill === right.fill
  && left.stroke === right.stroke
  && left.text === right.text
  && left.group === right.group
  && left.align === right.align
  && left.distribute === right.distribute
  && left.makeGroup === right.makeGroup
  && left.ungroup === right.ungroup
  && left.order === right.order
  && left.filter === right.filter
  && left.lock === right.lock
  && left.copy === right.copy
  && left.cut === right.cut
  && left.duplicate === right.duplicate
  && left.delete === right.delete
)

export const isNodeSummaryEqual = (
  left: NodeSummary,
  right: NodeSummary
) => (
  left.count === right.count
  && left.hasGroup === right.hasGroup
  && left.lock === right.lock
  && left.mixed === right.mixed
  && left.types.length === right.types.length
  && left.types.every((item, index) => (
    item.type === right.types[index]?.type
    && item.name === right.types[index]?.name
    && item.family === right.types[index]?.family
    && item.icon === right.types[index]?.icon
    && item.count === right.types[index]?.count
  ))
)

export const readNodeSummaryTitle = (
  summary: NodeSummary
) => (
  summary.count <= 1
    ? (summary.types[0]?.name ?? 'Item')
    : `${summary.count} items`
)

export const readNodeSummaryDetail = (
  summary: NodeSummary
) => {
  if (!summary.types.length) {
    return undefined
  }

  return summary.types
    .map((item) => item.count > 1 ? `${item.name} ×${item.count}` : item.name)
    .join(' · ')
}

export const readLockLabel = (
  summary: NodeSummary
) => (
  summary.lock === 'all'
    ? (summary.count > 1 ? 'Unlock selected' : 'Unlock')
    : (summary.count > 1 ? 'Lock selected' : 'Lock')
)
