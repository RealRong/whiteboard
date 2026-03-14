import type { Node, NodeSchema } from '@whiteboard/core/types'
import type { ReactNode } from 'react'
import type { InternalWhiteboardInstance } from '../common/instance'
import { resolveNodeActions } from '../selection'
import { setNodesLocked } from '../node/actions'

export type NodeToolbarItemKey =
  | 'fill'
  | 'stroke'
  | 'text'
  | 'group'
  | 'arrange'
  | 'lock'
  | 'more'

export type NodeToolbarMenuKey =
  | 'fill'
  | 'stroke'
  | 'text'
  | 'group'
  | 'arrange'
  | 'more'

export type NodeToolbarActionContext = {
  instance: InternalWhiteboardInstance
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NodeSchema
  close: () => void
}

export type NodeToolbarItemDefinition = {
  key: NodeToolbarItemKey
  label: string
  icon: ReactNode
  menuKey?: NodeToolbarMenuKey
  run?: (context: NodeToolbarActionContext) => void
}

export type NodeToolbarItem = {
  key: NodeToolbarItemKey
  label: string
  icon: ReactNode
  menuKey?: NodeToolbarMenuKey
  active: boolean
  run?: (context: NodeToolbarActionContext) => void
}

export type NodeToolbarMenuProps = NodeToolbarActionContext

export type NodeToolbarSource = {
  node: Node
  schema?: NodeSchema
}

type ToolbarCapabilityKey = 'fill' | 'stroke' | 'text' | 'group'

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

export const hasSchemaField = (
  schema: NodeSchema | undefined,
  scope: 'data' | 'style',
  path: string
) => schema?.fields.some((field) => field.scope === scope && field.path === path) ?? false

export const readTextFieldKey = (
  node: Node,
  schema?: NodeSchema
): 'title' | 'text' => {
  const schemaField = schema?.fields.find((field) =>
    field.scope === 'data' && (field.path === 'text' || field.path === 'title')
  )

  if (schemaField?.path === 'text' || schemaField?.path === 'title') {
    return schemaField.path
  }

  if (typeof node.data?.text === 'string') return 'text'
  return 'title'
}

export const readTextValue = (
  node: Node,
  schema?: NodeSchema
) => {
  const key = readTextFieldKey(node, schema)
  const value = node.data?.[key]
  return typeof value === 'string' ? value : ''
}

const hasCapabilitySchemaField = (
  schema: NodeSchema | undefined,
  key: ToolbarCapabilityKey
) => SCHEMA_FIELDS_BY_CAPABILITY[key].some((field) =>
  hasSchemaField(schema, field.scope, field.path)
)

const readToolbarCapabilities = ({
  node,
  schema
}: NodeToolbarSource): Record<ToolbarCapabilityKey, boolean> => ({
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

const resolveToolbarKeys = (
  capabilities: Record<ToolbarCapabilityKey, boolean>,
  capabilityOrder: readonly ToolbarCapabilityKey[]
): NodeToolbarItemKey[] => [
  ...capabilityOrder.filter((key) => capabilities[key]),
  ...STATIC_ITEM_KEYS
]

const SvgIcon = ({
  children,
  viewBox = '0 0 24 24'
}: {
  children: ReactNode
  viewBox?: string
}) => (
  <svg viewBox={viewBox} aria-hidden="true" className="wb-node-toolbar-icon">
    {children}
  </svg>
)

const icons = {
  fill: (
    <SvgIcon>
      <path d="M6 4h8l4 4v1l-7 7-6-6 7-6Z" fill="currentColor" opacity="0.9" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  stroke: (
    <SvgIcon>
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  text: (
    <SvgIcon>
      <path d="M6 6h12M12 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </SvgIcon>
  ),
  group: (
    <SvgIcon>
      <rect x="4" y="6" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="11" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </SvgIcon>
  ),
  arrange: (
    <SvgIcon>
      <rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="10" y="10" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.25" />
    </SvgIcon>
  ),
  lock: (
    <SvgIcon>
      <path d="M8 11V8.5a4 4 0 1 1 8 0V11" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="11" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </SvgIcon>
  ),
  more: (
    <SvgIcon>
      <circle cx="6.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="17.5" cy="12" r="1.6" fill="currentColor" />
    </SvgIcon>
  )
}

const itemDefinitions: Record<NodeToolbarItemKey, NodeToolbarItemDefinition> = {
  fill: {
    key: 'fill',
    label: 'Fill',
    icon: icons.fill,
    menuKey: 'fill'
  },
  stroke: {
    key: 'stroke',
    label: 'Stroke',
    icon: icons.stroke,
    menuKey: 'stroke'
  },
  text: {
    key: 'text',
    label: 'Text',
    icon: icons.text,
    menuKey: 'text'
  },
  group: {
    key: 'group',
    label: 'Group',
    icon: icons.group,
    menuKey: 'group'
  },
  arrange: {
    key: 'arrange',
    label: 'Arrange',
    icon: icons.arrange,
    menuKey: 'arrange'
  },
  lock: {
    key: 'lock',
    label: 'Lock',
    icon: icons.lock,
    run: ({ instance, nodes, close }) => {
      const nextLocked = !resolveNodeActions(nodes).allLocked
      void setNodesLocked(instance, nodes, nextLocked).finally(close)
    }
  },
  more: {
    key: 'more',
    label: 'More',
    icon: icons.more,
    menuKey: 'more'
  }
}

const resolveItem = (
  definition: NodeToolbarItemDefinition,
  actions: ReturnType<typeof resolveNodeActions>
): NodeToolbarItem => (
  definition.key === 'lock'
    ? {
        ...definition,
        label: actions.lockLabel,
        active: actions.allLocked
      }
    : {
        ...definition,
        active: false
      }
)

export const resolveNodeToolbarItems = ({
  sources,
  nodes
}: {
  sources: readonly NodeToolbarSource[]
  nodes: readonly Node[]
}): NodeToolbarItem[] => {
  if (!sources.length || !nodes.length) return []

  const capabilities = sources.map(readToolbarCapabilities)
  const keys = sources.length === 1
    ? resolveToolbarKeys(capabilities[0], SINGLE_CAPABILITY_ORDER)
    : resolveToolbarKeys({
        fill: capabilities.every((capability) => capability.fill),
        stroke: capabilities.every((capability) => capability.stroke),
        text: false,
        group: false
      }, MULTI_CAPABILITY_ORDER)
  const actions = resolveNodeActions(nodes)

  return keys.map((key) => resolveItem(itemDefinitions[key], actions))
}
