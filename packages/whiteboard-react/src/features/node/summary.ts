import type { SelectionCan, SelectionSnapshot } from '@whiteboard/editor'
import type { Node, NodeId } from '@whiteboard/core/types'
import type {
  ControlId,
  NodeFamily,
  NodeMeta,
  NodeRegistry
} from '../../types/node'

export type NodeTypeSummary = {
  key: string
  name: string
  family: NodeFamily
  icon: string
  count: number
  nodeIds: readonly NodeId[]
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

type NodeSummaryView = {
  types: readonly NodeTypeSummary[]
  overflow: number
  title: string
  detail?: string
  mixed: boolean
}

const DEFAULT_PREVIEW_LIMIT = 3
const EMPTY_CONTROLS: readonly ControlId[] = []

const readNodeMeta = (
  registry: Pick<NodeRegistry, 'get'>,
  node: Node
): NodeMeta => {
  const definition = registry.get(node.type)
  const meta = definition?.describe?.(node) ?? definition?.meta

  if (meta) {
    return meta
  }

  return {
    key: node.type,
    name: node.type,
    family: 'shape',
    icon: node.type,
    controls: EMPTY_CONTROLS
  }
}

export const readNodeSelectionCan = (
  can: SelectionCan
): NodeSelectionCan => ({
  fill: can.fill,
  stroke: can.stroke,
  text: can.text,
  group: can.group,
  align: can.align,
  distribute: can.distribute,
  makeGroup: can.makeGroup,
  ungroup: can.ungroup,
  order: can.order,
  filter: can.filterByType,
  lock: can.lock,
  copy: can.copy,
  cut: can.cut,
  duplicate: can.duplicate,
  delete: can.delete
})

export const readNodeSummary = ({
  selection,
  registry
}: {
  selection: SelectionSnapshot
  registry: Pick<NodeRegistry, 'get'>
}): NodeSummary => {
  const nodes = selection.summary.items.nodes
  const ids = selection.summary.target.nodeIds
  const count = ids.length
  const hasGroup = nodes.some((node) => node.type === 'group')
  const lockedCount = nodes.reduce(
    (total, node) => total + (node.locked ? 1 : 0),
    0
  )
  const nodeById = new Map<NodeId, Node>()
  nodes.forEach((node) => {
    nodeById.set(node.id, node)
  })

  const types = selection.types.map((entry) => {
    const node = nodeById.get(entry.nodeIds[0] as NodeId)
    const meta = node
      ? readNodeMeta(registry, node)
      : {
          key: entry.type,
          name: entry.type,
          family: 'shape' as const,
          icon: entry.type
        }

    return {
      key: meta.key ?? entry.type,
      name: meta.name,
      family: meta.family,
      icon: meta.icon,
      count: entry.count,
      nodeIds: entry.nodeIds
    }
  })

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

export const readNodeLockLabel = (
  summary: NodeSummary
) => (
  summary.lock === 'all'
    ? (summary.count > 1 ? 'Unlock selected' : 'Unlock')
    : (summary.count > 1 ? 'Lock selected' : 'Lock')
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

export const readNodeSummaryView = (
  summary: NodeSummary,
  options?: {
    previewLimit?: number
  }
): NodeSummaryView | undefined => {
  const previewLimit = Math.max(1, options?.previewLimit ?? DEFAULT_PREVIEW_LIMIT)
  const types = summary.types.slice(0, previewLimit)

  if (!summary.count || !types.length) {
    return undefined
  }

  return {
    types,
    overflow: Math.max(0, summary.types.length - types.length),
    title: readNodeSummaryTitle(summary),
    detail: readNodeSummaryDetail(summary),
    mixed: summary.mixed
  }
}
