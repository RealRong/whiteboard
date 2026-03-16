import type { Node, NodeSchema, Point, Rect } from '@whiteboard/core/types'
import { useInternalInstance, useSelection } from '../../runtime/hooks'
import { useViewport } from '../../runtime/viewport'
import { resolveNodeCaps } from '../../runtime/nodeCaps'
import { hasSchemaField } from './schema'
import type {
  NodeToolbarItem,
  NodeToolbarItemKey
} from './types'

export type NodeToolbarPlacement = 'top' | 'bottom'

export type NodeToolbarModel = {
  items: readonly NodeToolbarItem[]
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NodeSchema
  placement: NodeToolbarPlacement
  anchor: Point
}

type NodeToolbarSource = {
  node: Node
  schema?: NodeSchema
}

type ToolbarCapabilityKey = 'fill' | 'stroke' | 'text' | 'group'
type ToolbarCapabilities = Record<ToolbarCapabilityKey, boolean>
type ToolbarMode = 'single' | 'multi'

const TOOLBAR_VERTICAL_GAP = 12
const TOOLBAR_MIN_TOP_SPACE = 56

const SCHEMA_FIELDS_BY_CAPABILITY: Record<
  ToolbarCapabilityKey,
  readonly { scope: 'data' | 'style'; path: string }[]
> = {
  fill: [
    { scope: 'style', path: 'fill' }
  ],
  stroke: [
    { scope: 'style', path: 'stroke' },
    { scope: 'style', path: 'strokeWidth' }
  ],
  text: [
    { scope: 'data', path: 'text' },
    { scope: 'data', path: 'title' },
    { scope: 'style', path: 'color' },
    { scope: 'style', path: 'fontSize' }
  ],
  group: [
    { scope: 'data', path: 'collapsed' },
    { scope: 'data', path: 'autoFit' }
  ]
}

const NODE_TYPES_BY_CAPABILITY: Record<
  ToolbarCapabilityKey,
  ReadonlySet<string>
> = {
  fill: new Set([
    'rect',
    'sticky',
    'group',
    'ellipse',
    'diamond',
    'triangle',
    'arrow-sticker',
    'callout',
    'highlight'
  ]),
  stroke: new Set([
    'rect',
    'group',
    'ellipse',
    'diamond',
    'triangle',
    'arrow-sticker',
    'callout',
    'highlight'
  ]),
  text: new Set([
    'text',
    'sticky'
  ]),
  group: new Set([
    'group'
  ])
}

const SINGLE_CAPABILITY_ORDER: readonly ToolbarCapabilityKey[] = [
  'fill',
  'stroke',
  'text',
  'group'
]

const MULTI_CAPABILITY_ORDER: readonly ToolbarCapabilityKey[] = [
  'fill',
  'stroke'
]

const STATIC_ITEM_KEYS: readonly NodeToolbarItemKey[] = [
  'arrange',
  'lock',
  'more'
]

const hasTextValue = (node: Node) => {
  const title = node.data?.title
  const text = node.data?.text
  return typeof title === 'string' || typeof text === 'string'
}

const hasCapabilitySchemaField = (
  schema: NodeSchema | undefined,
  key: ToolbarCapabilityKey
) => SCHEMA_FIELDS_BY_CAPABILITY[key].some((field) =>
  hasSchemaField(schema, field.scope, field.path)
)

const readCapabilities = ({
  node,
  schema
}: NodeToolbarSource): ToolbarCapabilities => ({
  fill:
    hasCapabilitySchemaField(schema, 'fill')
    || NODE_TYPES_BY_CAPABILITY.fill.has(node.type),
  stroke:
    hasCapabilitySchemaField(schema, 'stroke')
    || NODE_TYPES_BY_CAPABILITY.stroke.has(node.type),
  text:
    hasCapabilitySchemaField(schema, 'text')
    || NODE_TYPES_BY_CAPABILITY.text.has(node.type)
    || hasTextValue(node),
  group:
    hasCapabilitySchemaField(schema, 'group')
    || NODE_TYPES_BY_CAPABILITY.group.has(node.type)
})

const resolveSharedCapabilities = (
  capabilities: readonly ToolbarCapabilities[]
): ToolbarCapabilities => ({
  fill: capabilities.every((capability) => capability.fill),
  stroke: capabilities.every((capability) => capability.stroke),
  text: false,
  group: false
})

const resolveCapabilityOrder = (
  mode: ToolbarMode
): readonly ToolbarCapabilityKey[] => (
  mode === 'single'
    ? SINGLE_CAPABILITY_ORDER
    : MULTI_CAPABILITY_ORDER
)

const resolveItemKeys = (
  sources: readonly NodeToolbarSource[]
): NodeToolbarItemKey[] => {
  const capabilities = sources.map(readCapabilities)
  if (!capabilities.length) {
    return []
  }

  const mode: ToolbarMode = capabilities.length === 1 ? 'single' : 'multi'
  const sharedCapabilities =
    mode === 'single'
      ? capabilities[0]
      : resolveSharedCapabilities(capabilities)

  return [
    ...resolveCapabilityOrder(mode).filter((key) => sharedCapabilities[key]),
    ...STATIC_ITEM_KEYS
  ]
}

const buildToolbarItem = (
  key: NodeToolbarItemKey,
  caps: ReturnType<typeof resolveNodeCaps>
): NodeToolbarItem => (
  key === 'lock'
    ? {
        key,
        label: caps.lockLabel,
        active: caps.allLocked
      }
    : {
        key,
        label:
          key === 'fill'
            ? 'Fill'
            : key === 'stroke'
              ? 'Stroke'
              : key === 'text'
                ? 'Text'
                : key === 'group'
                  ? 'Group'
                  : key === 'arrange'
                    ? 'Arrange'
                    : 'More',
        active: false
      }
)

const resolvePlacement = ({
  worldToScreen,
  rect
}: {
  worldToScreen: (point: Point) => Point
  rect: Rect
}): {
  placement: NodeToolbarPlacement
  anchor: Point
} => {
  const topCenter = worldToScreen({
    x: rect.x + rect.width / 2,
    y: rect.y
  })
  const bottomCenter = worldToScreen({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height
  })
  const placement =
    topCenter.y - TOOLBAR_VERTICAL_GAP > TOOLBAR_MIN_TOP_SPACE
      ? 'top'
      : 'bottom'

  return {
    placement,
    anchor: placement === 'top' ? topCenter : bottomCenter
  }
}

export const useNodeToolbar = (): NodeToolbarModel | undefined => {
  const instance = useInternalInstance()
  const selection = useSelection()
  useViewport()

  const rect = selection.box
  const nodes = selection.items.nodes
  const primaryNode = selection.items.primary

  if (!rect || !primaryNode || !nodes.length) {
    return undefined
  }

  const sources = nodes.map((node) => ({
    node,
    schema: instance.registry.get(node.type)?.schema
  }))
  const caps = resolveNodeCaps(nodes)
  const items = resolveItemKeys(sources).map((key) => buildToolbarItem(key, caps))
  if (!items.length) {
    return undefined
  }

  const { placement, anchor } = resolvePlacement({
    worldToScreen: instance.viewport.worldToScreen,
    rect
  })

  return {
    items,
    nodes,
    primaryNode,
    primarySchema: instance.registry.get(primaryNode.type)?.schema,
    placement,
    anchor
  }
}
