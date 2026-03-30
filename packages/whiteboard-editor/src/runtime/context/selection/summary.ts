import type { Node, NodeId } from '@whiteboard/core/types'
import type {
  ControlId,
  NodeMeta,
  NodeRegistry
} from '../../../types/node'
import type {
  SelectionCan,
  SelectionNodeSummary
} from '../../../types/public/context'

const EMPTY_IDS: readonly NodeId[] = []
const EMPTY_TYPES: SelectionNodeSummary['types'] = []
const EMPTY_CONTROLS: readonly ControlId[] = []
const EMPTY_CAN: SelectionCan = {
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

const hasControl = (
  meta: NodeMeta,
  control: ControlId
) => meta.controls.includes(control)

export const resolveContextNodeMeta = (
  registry: Pick<NodeRegistry, 'get'>,
  node: Node
) => readNodeMeta(registry, node)

export const summarizeContextNodes = ({
  nodes,
  resolveMeta
}: {
  nodes: readonly Node[]
  resolveMeta: (node: Node) => NodeMeta
}): SelectionNodeSummary => {
  const ids = nodes.length > 0 ? nodes.map((node) => node.id) : EMPTY_IDS
  const count = ids.length
  const hasGroup = nodes.some((node) => node.type === 'group')
  const lockedCount = nodes.reduce(
    (total, node) => total + (node.locked ? 1 : 0),
    0
  )
  const typeCountByKey = new Map<string, {
    key: string
    name: string
    family: NodeMeta['family']
    icon: string
    count: number
    nodeIds: NodeId[]
  }>()

  nodes.forEach((node) => {
    const meta = resolveMeta(node)
    const key = meta.key ?? node.type
    const current = typeCountByKey.get(key)
    if (current) {
      current.count += 1
      current.nodeIds.push(node.id)
      return
    }

    typeCountByKey.set(key, {
      key,
      name: meta.name,
      family: meta.family,
      icon: meta.icon,
      count: 1,
      nodeIds: [node.id]
    })
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
    types: typeCountByKey.size > 0
      ? [...typeCountByKey.values()]
        .sort((left, right) => (
          right.count - left.count || left.name.localeCompare(right.name)
        ))
      : EMPTY_TYPES,
    mixed: typeCountByKey.size > 1
  }
}

export const resolveContextSelectionCan = ({
  nodes,
  resolveMeta
}: {
  nodes: readonly Node[]
  resolveMeta: (node: Node) => NodeMeta
}): SelectionCan => {
  const count = nodes.length

  if (!count) {
    return EMPTY_CAN
  }

  const metas = nodes.map((node) => resolveMeta(node))
  const hasShared = (control: ControlId) => metas.every((meta) => hasControl(meta, control))
  const mixedTypes = new Set(
    nodes.map((node, index) => metas[index]?.key ?? node.type)
  ).size > 1

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

export const readContextLockLabel = (
  summary: SelectionNodeSummary
) => (
  summary.lock === 'all'
    ? (summary.count > 1 ? 'Unlock selected' : 'Unlock')
    : (summary.count > 1 ? 'Lock selected' : 'Lock')
)
