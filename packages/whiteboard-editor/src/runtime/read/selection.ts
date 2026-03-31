import {
  deriveSelectionSummary,
  isSelectionSummaryEqual,
  resolveSelectionBoxTarget,
  type SelectionTarget
} from '@whiteboard/core/selection'
import {
  createDerivedStore,
  type ReadFn,
  type ReadStore
} from '@whiteboard/engine'
import type { Edge, Node, NodeId, NodeSchema } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import type {
  ControlId,
  NodeMeta
} from '../../types/node'
import type {
  SelectionCan,
  SelectionSnapshot,
  SelectionStyleSnapshot,
  SelectionTypeStat
} from '../../types/selection'
import type { EdgeRead } from './edge'
import type { NodeRead } from './node'
import type { TargetBoundsQuery } from '../query/targetBounds'

export type SelectionRead = ReadStore<SelectionSnapshot>

const EMPTY_TYPES: readonly SelectionTypeStat[] = []

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
  filterByType: false,
  lock: false,
  copy: false,
  cut: false,
  duplicate: false,
  delete: false
}

const hasStyleField = (
  schema: NodeSchema | undefined,
  path: string
) => schema?.fields.some((field) => field.scope === 'style' && field.path === path) ?? false

const canEditStrokeStyle = (
  node: Node,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'stroke')
  || hasStyleField(schema, 'strokeWidth')
  || typeof node.style?.stroke === 'string'
  || typeof node.style?.strokeWidth === 'number'
)

const canEditOpacityStyle = (
  node: Node,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'opacity')
  || typeof node.style?.opacity === 'number'
)

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

const hasControl = (
  meta: NodeMeta,
  control: ControlId
) => meta.controls.includes(control)

const deriveSelectionCan = ({
  nodes,
  registry
}: {
  nodes: readonly Node[]
  registry: NodeRegistry
}): SelectionCan => {
  const count = nodes.length
  if (!count) {
    return EMPTY_CAN
  }

  const metas = nodes.map((node) => readNodeMeta(registry, node))
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
    filterByType: mixedTypes,
    lock: true,
    copy: true,
    cut: true,
    duplicate: true,
    delete: true
  }
}

const deriveSelectionTypeStats = (
  nodes: readonly Node[]
): readonly SelectionTypeStat[] => {
  if (!nodes.length) {
    return EMPTY_TYPES
  }

  const statsByType = new Map<string, {
    type: string
    count: number
    nodeIds: NodeId[]
  }>()

  nodes.forEach((node) => {
    const current = statsByType.get(node.type)
    if (current) {
      current.count += 1
      current.nodeIds.push(node.id)
      return
    }

    statsByType.set(node.type, {
      type: node.type,
      count: 1,
      nodeIds: [node.id]
    })
  })

  return [...statsByType.values()].sort((left, right) => (
    right.count - left.count || left.type.localeCompare(right.type)
  ))
}

const deriveSelectionStyleSnapshot = ({
  nodes,
  edges,
  registry
}: {
  nodes: readonly Node[]
  edges: readonly Edge[]
  registry: NodeRegistry
}): SelectionStyleSnapshot | null => {
  if (!nodes.length || edges.length > 0) {
    return null
  }

  const sources = nodes.map((node) => ({
    node,
    schema: registry.get(node.type)?.schema
  }))
  const supportsStroke = sources.every(({ node, schema }) => canEditStrokeStyle(node, schema))
  if (!supportsStroke) {
    return null
  }

  const supportsOpacity = sources.every(({ node, schema }) => canEditOpacityStyle(node, schema))
  const primary = nodes[0]
  const stroke = typeof primary?.style?.stroke === 'string'
    ? primary.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const strokeWidth = typeof primary?.style?.strokeWidth === 'number'
    ? primary.style.strokeWidth
    : 1
  const opacity = typeof primary?.style?.opacity === 'number'
    ? primary.style.opacity
    : 1

  return {
    stroke,
    strokeWidth,
    strokeWidthPreset: nodes.every((node) => node.type === 'draw')
      ? 'draw'
      : 'default',
    opacity: supportsOpacity ? opacity : undefined
  }
}

const isSelectionCanEqual = (
  left: SelectionCan,
  right: SelectionCan
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
  && left.filterByType === right.filterByType
  && left.lock === right.lock
  && left.copy === right.copy
  && left.cut === right.cut
  && left.duplicate === right.duplicate
  && left.delete === right.delete
)

const isSelectionTypeStatsEqual = (
  left: readonly SelectionTypeStat[],
  right: readonly SelectionTypeStat[]
) => (
  left.length === right.length
  && left.every((entry, index) => {
    const next = right[index]
    if (!next) {
      return false
    }

    return (
      entry.type === next.type
      && entry.count === next.count
      && entry.nodeIds.length === next.nodeIds.length
      && entry.nodeIds.every((nodeId, nodeIndex) => nodeId === next.nodeIds[nodeIndex])
    )
  })
)

const isSelectionStyleSnapshotEqual = (
  left: SelectionStyleSnapshot | null,
  right: SelectionStyleSnapshot | null
) => (
  left === right
  || (
    left !== null
    && right !== null
    && left.stroke === right.stroke
    && left.strokeWidth === right.strokeWidth
    && left.strokeWidthPreset === right.strokeWidthPreset
    && left.opacity === right.opacity
  )
)

const isSelectionSnapshotEqual = (
  left: SelectionSnapshot,
  right: SelectionSnapshot
) => (
  isSelectionSummaryEqual(left.summary, right.summary)
  && isSelectionCanEqual(left.can, right.can)
  && isSelectionTypeStatsEqual(left.types, right.types)
  && isSelectionStyleSnapshotEqual(left.style, right.style)
)

const readRuntimeNodes = (
  node: Pick<NodeRead, 'item' | 'list'>,
  readStore: ReadFn
) => readStore(node.list)
  .map((nodeId) => readStore(node.item, nodeId)?.node)
  .filter((entry): entry is Node => Boolean(entry))

export const createSelectionRead = ({
  source,
  node,
  edge,
  targetBounds,
  registry
}: {
  source: ReadStore<SelectionTarget>
  node: NodeRead
  edge: EdgeRead
  targetBounds: TargetBoundsQuery
  registry: NodeRegistry
}): SelectionRead => {
  return createDerivedStore<SelectionSnapshot>({
    get: (readStore) => {
      const selectionSource = readStore(source)
      const runtimeNodes = readRuntimeNodes(node, readStore)
      const nodes = selectionSource.nodeIds
        .map((nodeId) => readStore(node.item, nodeId)?.node)
        .filter((node): node is Node => Boolean(node))
      const edges = selectionSource.edgeIds
        .map((edgeId) => readStore(edge.item, edgeId)?.edge)
        .filter((edge): edge is Edge => Boolean(edge))
      const summary = deriveSelectionSummary({
        target: selectionSource,
        nodes,
        edges,
        readBounds: (target) => targetBounds.track(
          readStore,
          resolveSelectionBoxTarget(target, runtimeNodes)
        ),
        isNodeScalable: (entry) => (
          !entry.locked
          && node.capability(entry).role !== 'frame'
        ),
        resolveNodeTransformCapability: (entry) => {
          const capability = node.capability(entry)
          return {
            resize: capability.resize,
            rotate: capability.rotate
          }
        }
      })

      return {
        summary,
        can: deriveSelectionCan({
          nodes,
          registry
        }),
        types: deriveSelectionTypeStats(nodes),
        style: deriveSelectionStyleSnapshot({
          nodes,
          edges,
          registry
        })
      }
    },
    isEqual: isSelectionSnapshotEqual
  })
}
