import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react'
import type { Node, NodeSchema, Point, Rect } from '@whiteboard/core/types'
import {
  useInternalInstance,
  useInteraction,
  useSelection,
  useTool,
  useViewport
} from '../../../runtime/hooks'
import { setNodesLocked } from '../../../features/node/commands'
import { resolveNodeCaps } from '../../../runtime/nodeCaps'
import { ArrangeMenu } from '../../node-toolbar/menus/ArrangeMenu'
import { FillMenu } from '../../node-toolbar/menus/FillMenu'
import { GroupMenu } from '../../node-toolbar/menus/GroupMenu'
import { MoreMenu } from '../../node-toolbar/menus/MoreMenu'
import { StrokeMenu } from '../../node-toolbar/menus/StrokeMenu'
import { TextMenu } from '../../node-toolbar/menus/TextMenu'
import { hasSchemaField } from '../../node-toolbar/schema'
import type {
  NodeToolbarActionContext,
  NodeToolbarItemKey,
  NodeToolbarMenuKey
} from '../../node-toolbar/types'

type ToolbarItemDefinition = {
  icon: ReactNode
  run?: (props: NodeToolbarActionContext, active: boolean) => void
  renderMenu?: (props: NodeToolbarActionContext) => ReactNode
}

type ToolbarMenuAnchor = {
  top: number
  bottom: number
  centerX: number
}

type NodeToolbarPlacement = 'top' | 'bottom'

type NodeToolbarItem = {
  key: NodeToolbarItemKey
  label: string
  active: boolean
}

type NodeToolbarModel = {
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

const SAFE_MARGIN = 12
const MENU_WIDTH = 220
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

const resolveToolbarPlacement = ({
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

const resolveHorizontalPosition = (
  centerX: number,
  containerWidth: number,
  estimatedWidth: number
) => {
  if (centerX <= estimatedWidth / 2 + SAFE_MARGIN) {
    return {
      left: SAFE_MARGIN,
      transform: ''
    }
  }
  if (centerX >= containerWidth - estimatedWidth / 2 - SAFE_MARGIN) {
    return {
      left: containerWidth - SAFE_MARGIN,
      transform: 'translateX(-100%)'
    }
  }
  return {
    left: centerX,
    transform: 'translateX(-50%)'
  }
}

const buildToolbarStyle = ({
  placement,
  x,
  y,
  containerWidth,
  itemCount
}: {
  placement: 'top' | 'bottom'
  x: number
  y: number
  containerWidth: number
  itemCount: number
}): CSSProperties => {
  const widthEstimate = Math.max(160, itemCount * 36 + 28)
  const horizontal = resolveHorizontalPosition(x, containerWidth, widthEstimate)
  return {
    left: horizontal.left,
    top: y,
    transform: [horizontal.transform, placement === 'top' ? 'translateY(-100%)' : 'translateY(0)']
      .filter(Boolean)
      .join(' ')
  }
}

const buildToolbarMenuStyle = ({
  anchor,
  containerWidth,
  containerHeight
}: {
  anchor: ToolbarMenuAnchor
  containerWidth: number
  containerHeight: number
}): CSSProperties => {
  const horizontal = resolveHorizontalPosition(anchor.centerX, containerWidth, MENU_WIDTH)
  const placeBottom = containerHeight - anchor.bottom >= 240
  return {
    left: horizontal.left,
    top: placeBottom ? anchor.bottom + 8 : anchor.top - 8,
    transform: [horizontal.transform, placeBottom ? 'translateY(0)' : 'translateY(-100%)']
      .filter(Boolean)
      .join(' ')
  }
}

const toolbarItemDefinitions: Record<NodeToolbarItemKey, ToolbarItemDefinition> = {
  fill: {
    icon: (
      <SvgIcon>
        <path d="M6 4h8l4 4v1l-7 7-6-6 7-6Z" fill="currentColor" opacity="0.9" />
        <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SvgIcon>
    ),
    renderMenu: (props) => <FillMenu {...props} />
  },
  stroke: {
    icon: (
      <SvgIcon>
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SvgIcon>
    ),
    renderMenu: (props) => <StrokeMenu {...props} />
  },
  text: {
    icon: (
      <SvgIcon>
        <path d="M6 6h12M12 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </SvgIcon>
    ),
    renderMenu: (props) => <TextMenu {...props} />
  },
  group: {
    icon: (
      <SvgIcon>
        <rect x="4" y="6" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="11" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </SvgIcon>
    ),
    renderMenu: (props) => <GroupMenu {...props} />
  },
  arrange: {
    icon: (
      <SvgIcon>
        <rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="10" y="10" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.25" />
      </SvgIcon>
    ),
    renderMenu: (props) => <ArrangeMenu {...props} />
  },
  lock: {
    icon: (
      <SvgIcon>
        <path d="M8 11V8.5a4 4 0 1 1 8 0V11" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="6" y="11" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </SvgIcon>
    ),
    run: ({ instance, nodes, close }, active) => {
      void setNodesLocked(instance, nodes, !active).finally(close)
    }
  },
  more: {
    icon: (
      <SvgIcon>
        <circle cx="6.5" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="17.5" cy="12" r="1.6" fill="currentColor" />
      </SvgIcon>
    ),
    renderMenu: (props) => <MoreMenu {...props} />
  }
}

const isToolbarMenuKey = (
  key: NodeToolbarItemKey
): key is NodeToolbarMenuKey => key !== 'lock'

const readMenuAnchor = ({
  container,
  button
}: {
  container: HTMLDivElement | null
  button: HTMLButtonElement | null | undefined
}) => {
  if (!container || !button) return undefined

  const rect = button.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    top: rect.top - containerRect.top,
    bottom: rect.bottom - containerRect.top,
    centerX: rect.left - containerRect.left + rect.width / 2
  }
}

export const NodeToolbarLayer = ({
  containerRef,
  containerWidth,
  containerHeight
}: {
  containerRef: RefObject<HTMLDivElement | null>
  containerWidth: number
  containerHeight: number
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const interaction = useInteraction()
  const selection = useSelection()
  useViewport()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRefByKey = useRef<Partial<Record<NodeToolbarMenuKey, HTMLButtonElement | null>>>({})
  const [activeMenuKey, setActiveMenuKey] = useState<NodeToolbarMenuKey | null>(null)
  const closeMenu = useCallback(() => {
    setActiveMenuKey(null)
  }, [])
  const rect = selection.box
  const nodes = selection.items.nodes
  const primaryNode = selection.items.primary
  let toolbar: NodeToolbarModel | undefined

  if (rect && primaryNode && nodes.length) {
    const sources = nodes.map((node) => ({
      node,
      schema: instance.registry.get(node.type)?.schema
    }))
    const caps = resolveNodeCaps(nodes)
    const items = resolveItemKeys(sources).map((key) => buildToolbarItem(key, caps))

    if (items.length) {
      const { placement, anchor } = resolveToolbarPlacement({
        worldToScreen: instance.viewport.worldToScreen,
        rect
      })

      toolbar = {
        items,
        nodes,
        primaryNode,
        primarySchema: instance.registry.get(primaryNode.type)?.schema,
        placement,
        anchor
      }
    }
  }
  const showNodeToolbar =
    tool === 'select'
    && interaction === 'idle'
    && selection.target.edgeId === undefined
    && selection.items.count > 0

  useEffect(() => {
    closeMenu()
  }, [
    closeMenu,
    toolbar?.placement,
    toolbar?.anchor.x,
    toolbar?.anchor.y,
    toolbar?.nodes
  ])

  useEffect(() => {
    if (!showNodeToolbar) {
      closeMenu()
    }
  }, [closeMenu, showNodeToolbar])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) {
        return
      }
      closeMenu()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeMenu()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!showNodeToolbar || !toolbar) return null

  const toolbarStyle = buildToolbarStyle({
    placement: toolbar.placement,
    x: toolbar.anchor.x,
    y: toolbar.placement === 'top' ? toolbar.anchor.y - 12 : toolbar.anchor.y + 12,
    containerWidth,
    itemCount: toolbar.items.length
  })

  const activeMenuAnchor = activeMenuKey
    ? readMenuAnchor({
        container: containerRef.current,
        button: buttonRefByKey.current[activeMenuKey]
      })
    : undefined
  const activeMenuDefinition = activeMenuKey
    ? toolbarItemDefinitions[activeMenuKey]
    : undefined
  const menuStyle = activeMenuAnchor
    ? buildToolbarMenuStyle({
        anchor: activeMenuAnchor,
        containerWidth,
        containerHeight
      })
    : undefined

  const actionContext = {
    instance,
    nodes: toolbar.nodes,
    primaryNode: toolbar.primaryNode,
    primarySchema: toolbar.primarySchema,
    close: closeMenu
  }

  return (
    <div className="wb-node-toolbar-layer" ref={rootRef}>
      <div
        className="wb-node-toolbar"
        style={toolbarStyle}
        data-context-menu-ignore
        data-selection-ignore
        data-input-ignore
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
      >
        {toolbar.items.map((item) => {
          const definition = toolbarItemDefinitions[item.key]
          const active = item.active || activeMenuKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              className="wb-node-toolbar-button"
              data-active={active ? 'true' : undefined}
              title={item.label}
              ref={(element) => {
                if (isToolbarMenuKey(item.key) && definition.renderMenu) {
                  buttonRefByKey.current[item.key] = element
                }
              }}
              data-selection-ignore
              data-input-ignore
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={() => {
                if (definition.run) {
                  definition.run(actionContext, item.active)
                  closeMenu()
                  return
                }
                if (!isToolbarMenuKey(item.key) || !definition.renderMenu) return
                const menuKey = item.key
                setActiveMenuKey((current) => current === menuKey ? null : menuKey)
              }}
            >
              {definition.icon}
            </button>
          )
        })}
      </div>
      {activeMenuDefinition?.renderMenu && menuStyle ? (
        <div
          className="wb-node-toolbar-menu"
          style={menuStyle}
          data-context-menu-ignore
          data-selection-ignore
          data-input-ignore
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
        >
          {activeMenuDefinition.renderMenu(actionContext)}
        </div>
      ) : null}
    </div>
  )
}
