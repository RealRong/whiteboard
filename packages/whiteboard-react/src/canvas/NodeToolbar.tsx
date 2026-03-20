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
  useSelection,
  useStoreValue
} from '../runtime/hooks'
import { mergeRecordPatch } from '../runtime/utils/recordPatch'
import {
  arrangeNodes,
  deleteNodes,
  duplicateNodes,
  toggleNodesLock,
  type GroupAutoFitMode,
  updateGroupNode
} from '../features/node/commands'
import {
  closeAfter
} from './actions'
import { measureTextSizeFromSource } from '../features/node/registry/default/shared'
import {
  readLockLabel,
  summarizeNodes,
  type NodeSummary
} from '../features/node/summary'
import { ArrangeMenu } from './menus/ArrangeMenu'
import { FillMenu } from './menus/FillMenu'
import { GroupMenu } from './menus/GroupMenu'
import { MoreMenu } from './menus/MoreMenu'
import { StrokeMenu } from './menus/StrokeMenu'
import { TextMenu } from './menus/TextMenu'

type Surface = {
  width: number
  height: number
}

type ToolbarItemKey =
  | 'fill'
  | 'stroke'
  | 'text'
  | 'group'
  | 'arrange'
  | 'lock'
  | 'more'

type ToolbarMenuKey = Exclude<ToolbarItemKey, 'lock'>
type ToolbarCapabilityKey = 'fill' | 'stroke' | 'text' | 'group'
type ToolbarPlacement = 'top' | 'bottom'

type ToolbarCapabilities = Record<ToolbarCapabilityKey, boolean>

type ToolbarItem = {
  key: ToolbarItemKey
  label: string
  active: boolean
}

type ToolbarSource = {
  node: Node
  schema?: NodeSchema
}

type ToolbarModel = {
  items: readonly ToolbarItem[]
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NodeSchema
  placement: ToolbarPlacement
  anchor: Point
}

type ToolbarMenuAnchor = {
  top: number
  bottom: number
  centerX: number
}

const SafeMargin = 12
const MenuWidth = 220
const ToolbarVerticalGap = 12
const ToolbarMinTopSpace = 56

const CapabilityFields: Record<
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

const NodeTypesByCapability: Record<
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

const SingleCapabilityOrder: readonly ToolbarCapabilityKey[] = [
  'fill',
  'stroke',
  'text',
  'group'
]

const MultiCapabilityOrder: readonly ToolbarCapabilityKey[] = [
  'fill',
  'stroke'
]

const StaticItemKeys: readonly ToolbarItemKey[] = [
  'arrange',
  'lock',
  'more'
]

const hasSchemaField = (
  schema: NodeSchema | undefined,
  scope: 'data' | 'style',
  path: string
) => schema?.fields.some((field) => field.scope === scope && field.path === path) ?? false

const readTextFieldKey = (
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

const readTextValue = (
  node: Node,
  schema?: NodeSchema
) => {
  const key = readTextFieldKey(node, schema)
  const value = node.data?.[key]
  return typeof value === 'string' ? value : ''
}

const hasTextValue = (node: Node) => (
  typeof node.data?.title === 'string' || typeof node.data?.text === 'string'
)

const hasCapabilitySchemaField = (
  schema: NodeSchema | undefined,
  key: ToolbarCapabilityKey
) => CapabilityFields[key].some((field) =>
  hasSchemaField(schema, field.scope, field.path)
)

const readCapabilities = ({
  node,
  schema
}: ToolbarSource): ToolbarCapabilities => ({
  fill:
    hasCapabilitySchemaField(schema, 'fill')
    || NodeTypesByCapability.fill.has(node.type),
  stroke:
    hasCapabilitySchemaField(schema, 'stroke')
    || NodeTypesByCapability.stroke.has(node.type),
  text:
    hasCapabilitySchemaField(schema, 'text')
    || NodeTypesByCapability.text.has(node.type)
    || hasTextValue(node),
  group:
    hasCapabilitySchemaField(schema, 'group')
    || NodeTypesByCapability.group.has(node.type)
})

const resolveSharedCapabilities = (
  capabilities: readonly ToolbarCapabilities[]
): ToolbarCapabilities => ({
  fill: capabilities.every((capability) => capability.fill),
  stroke: capabilities.every((capability) => capability.stroke),
  text: false,
  group: false
})

const resolveItemKeys = (
  sources: readonly ToolbarSource[]
): ToolbarItemKey[] => {
  const capabilities = sources.map(readCapabilities)
  if (!capabilities.length) {
    return []
  }

  const singleMode = capabilities.length === 1
  const sharedCapabilities = singleMode
    ? capabilities[0]
    : resolveSharedCapabilities(capabilities)

  const capabilityOrder = singleMode
    ? SingleCapabilityOrder
    : MultiCapabilityOrder

  return [
    ...capabilityOrder.filter((key) => sharedCapabilities[key]),
    ...StaticItemKeys
  ]
}

const buildToolbarItem = (
  key: ToolbarItemKey,
  summary: NodeSummary
): ToolbarItem => (
  key === 'lock'
    ? {
        key,
        label: readLockLabel(summary),
        active: summary.lock === 'all'
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

const SvgIcon = ({
  children,
  viewBox = '0 0 24 24'
}: {
  children: ReactNode
  viewBox?: string
}) => (
  <svg
    viewBox={viewBox}
    aria-hidden="true"
    className="wb-node-toolbar-icon"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const IconStrokeWidth = 1

const ToolbarIcons: Record<ToolbarItemKey, ReactNode> = {
  fill: (
    <SvgIcon>
      <path d="M8 5.5h6l3.5 3.5v1L11 17.5 6.5 13l7-7.5Z" stroke="currentColor" strokeWidth={IconStrokeWidth} />
      <path d="M5 19.5h14" stroke="currentColor" strokeWidth={IconStrokeWidth} />
    </SvgIcon>
  ),
  stroke: (
    <SvgIcon>
      <circle cx="12" cy="11" r="5.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth={IconStrokeWidth} />
    </SvgIcon>
  ),
  text: (
    <SvgIcon>
      <path d="M7 6.5h10" stroke="currentColor" strokeWidth={IconStrokeWidth} />
      <path d="M12 6.5v11" stroke="currentColor" strokeWidth={IconStrokeWidth} />
    </SvgIcon>
  ),
  group: (
    <SvgIcon>
      <rect x="4.5" y="6.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
      <rect x="12.5" y="10.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
    </SvgIcon>
  ),
  arrange: (
    <SvgIcon>
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
      <rect x="10" y="10" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
    </SvgIcon>
  ),
  lock: (
    <SvgIcon>
      <path d="M8.5 10.5V8.75a3.5 3.5 0 1 1 7 0v1.75" stroke="currentColor" strokeWidth={IconStrokeWidth} />
      <rect x="7" y="10.5" width="10" height="8.5" rx="2" stroke="currentColor" strokeWidth={IconStrokeWidth} />
    </SvgIcon>
  ),
  more: (
    <SvgIcon>
      <circle cx="7" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="17" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </SvgIcon>
  )
}

const resolveToolbarPlacement = ({
  worldToScreen,
  rect
}: {
  worldToScreen: (point: Point) => Point
  rect: Rect
}) => {
  const topCenter = worldToScreen({
    x: rect.x + rect.width / 2,
    y: rect.y
  })
  const bottomCenter = worldToScreen({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height
  })
  const placement =
    topCenter.y - ToolbarVerticalGap > ToolbarMinTopSpace
      ? 'top'
      : 'bottom'

  return {
    placement,
    anchor: placement === 'top' ? topCenter : bottomCenter
  } as {
    placement: ToolbarPlacement
    anchor: Point
  }
}

const resolveHorizontalPosition = (
  centerX: number,
  containerWidth: number,
  estimatedWidth: number
) => {
  if (centerX <= estimatedWidth / 2 + SafeMargin) {
    return {
      left: SafeMargin,
      transform: ''
    }
  }
  if (centerX >= containerWidth - estimatedWidth / 2 - SafeMargin) {
    return {
      left: containerWidth - SafeMargin,
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
  placement: ToolbarPlacement
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
  const horizontal = resolveHorizontalPosition(anchor.centerX, containerWidth, MenuWidth)
  const placeBottom = containerHeight - anchor.bottom >= 240
  return {
    left: horizontal.left,
    top: placeBottom ? anchor.bottom + 8 : anchor.top - 8,
    transform: [horizontal.transform, placeBottom ? 'translateY(0)' : 'translateY(-100%)']
      .filter(Boolean)
      .join(' ')
  }
}

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

const mergeStyle = (
  current: Record<string, string | number> | undefined,
  patch: Record<string, string | number>
) => mergeRecordPatch(current, patch)

const mergeData = (
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
) => mergeRecordPatch(current, patch)

const removeStyleKey = (
  current: Record<string, string | number> | undefined,
  key: string
) => {
  if (!current || !(key in current)) {
    return current
  }

  const next = {
    ...current
  }
  delete next[key]
  return Object.keys(next).length > 0 ? next : undefined
}

const updateNodesStyle = (
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands'>,
  nodes: readonly Node[],
  patch: Record<string, string | number>
) => instance.commands.node.updateMany(nodes.map((node) => ({
  id: node.id,
  patch: {
    style: mergeStyle(node.style, patch)
  }
})))

const updateNodeStyle = (
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands'>,
  node: Node,
  patch: Record<string, string | number>
) => instance.commands.node.update(node.id, {
  style: mergeStyle(node.style, patch)
})

const removeNodeStyle = (
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands'>,
  node: Node,
  key: string
) => instance.commands.node.update(node.id, {
  style: removeStyleKey(node.style, key)
})

const queryNodeTextSource = ({
  container,
  nodeId,
  field
}: {
  container: HTMLDivElement | null
  nodeId: string
  field: 'title' | 'text'
}) => {
  if (!container) {
    return undefined
  }

  const element = container.querySelector(
    `[data-node-id="${nodeId}"] [data-node-editable-field="${field}"]`
  )

  return element instanceof HTMLElement
    ? element
    : undefined
}

const updateToolbarTextNode = ({
  instance,
  container,
  node,
  field,
  value
}: {
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands' | 'engine'>
  container: HTMLDivElement | null
  node: Node
  field: 'title' | 'text'
  value: string
}) => {
  if (node.type !== 'text') {
    instance.commands.node.updateData(node.id, { [field]: value })
    return
  }

  const patch: Record<string, unknown> = {
    data: mergeData(node.data, { [field]: value })
  }
  const source = queryNodeTextSource({
    container,
    nodeId: node.id,
    field
  })
  const committedRect = instance.engine.read.node.item.get(node.id)?.rect
  const size = source && committedRect
    ? measureTextSizeFromSource({
        content: value,
        placeholder: 'Text',
        source,
        minWidth: 24,
        maxWidth: Math.max(640, committedRect.width)
      })
    : undefined

  if (
    size
    && committedRect
    && (size.width !== committedRect.width || size.height !== committedRect.height)
  ) {
    patch.size = size
  }

  instance.commands.node.update(node.id, patch)
}

const updateToolbarTextFontSize = ({
  instance,
  container,
  node,
  field,
  value
}: {
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands' | 'engine'>
  container: HTMLDivElement | null
  node: Node
  field: 'title' | 'text'
  value: number | undefined
}) => {
  if (node.type !== 'text') {
    if (value === undefined) {
      removeNodeStyle(instance, node, 'fontSize')
      return
    }
    updateNodeStyle(instance, node, { fontSize: value })
    return
  }

  const nextStyle = value === undefined
    ? removeStyleKey(node.style, 'fontSize')
    : mergeStyle(node.style, { fontSize: value })
  const patch: Record<string, unknown> = {
    style: nextStyle
  }
  const source = queryNodeTextSource({
    container,
    nodeId: node.id,
    field
  })
  const committedRect = instance.engine.read.node.item.get(node.id)?.rect
  const textValue = typeof node.data?.[field] === 'string'
    ? node.data[field] as string
    : ''
  const size = source && committedRect
    ? measureTextSizeFromSource({
        content: textValue,
        placeholder: 'Text',
        source,
        minWidth: 24,
        maxWidth: Math.max(640, committedRect.width),
        fontSize: value
      })
    : undefined

  if (
    size
    && committedRect
    && (size.width !== committedRect.width || size.height !== committedRect.height)
  ) {
    patch.size = size
  }

  instance.commands.node.update(node.id, patch)
}

const isToolbarMenuKey = (
  key: ToolbarItemKey
): key is ToolbarMenuKey => key !== 'lock'

export const NodeToolbar = ({
  containerRef,
  surface
}: {
  containerRef: RefObject<HTMLDivElement | null>
  surface: Surface
}) => {
  const instance = useInternalInstance()
  const viewport = useStoreValue(instance.viewport)
  const chrome = useStoreValue(instance.read.node.chrome)
  const selection = useSelection()
  const worldToScreen = useCallback(
    (point: Point) => instance.viewport.worldToScreen(point),
    [instance, viewport.center.x, viewport.center.y, viewport.zoom]
  )
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRefByKey = useRef<Partial<Record<ToolbarMenuKey, HTMLButtonElement | null>>>({})
  const [activeMenuKey, setActiveMenuKey] = useState<ToolbarMenuKey | null>(null)
  const closeMenu = useCallback(() => {
    setActiveMenuKey(null)
  }, [])
  const rect = selection.box
  const nodes = selection.items.nodes
  const primaryNode = selection.items.primary
  let toolbar: ToolbarModel | undefined

  if (rect && primaryNode && nodes.length) {
    const sources = nodes.map((node) => ({
      node,
      schema: instance.registry.get(node.type)?.schema
    }))
    const summary = summarizeNodes(nodes)
    const items = resolveItemKeys(sources).map((key) => buildToolbarItem(key, summary))

    if (items.length) {
      const { placement, anchor } = resolveToolbarPlacement({
        worldToScreen,
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

  const showsNodeToolbar = chrome.toolbar

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
    if (!showsNodeToolbar) {
      closeMenu()
    }
  }, [closeMenu, showsNodeToolbar])

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
  }, [closeMenu])

  if (!showsNodeToolbar || !toolbar) return null

  const toolbarStyle = buildToolbarStyle({
    placement: toolbar.placement,
    x: toolbar.anchor.x,
    y: toolbar.placement === 'top' ? toolbar.anchor.y - 12 : toolbar.anchor.y + 12,
    containerWidth: surface.width,
    itemCount: toolbar.items.length
  })

  const activeMenuAnchor = activeMenuKey
    ? readMenuAnchor({
        container: containerRef.current,
        button: buttonRefByKey.current[activeMenuKey]
      })
    : undefined
  const menuStyle = activeMenuAnchor
    ? buildToolbarMenuStyle({
        anchor: activeMenuAnchor,
        containerWidth: surface.width,
        containerHeight: surface.height
      })
    : undefined

  const summary = summarizeNodes(toolbar.nodes)
  const nodeIds = summary.ids
  const primarySchema = toolbar.primarySchema
  const fillValue = typeof toolbar.primaryNode.style?.fill === 'string'
    ? toolbar.primaryNode.style.fill
    : toolbar.primaryNode.type === 'sticky' && typeof toolbar.primaryNode.data?.background === 'string'
      ? toolbar.primaryNode.data.background
      : undefined
  const strokeValue = typeof toolbar.primaryNode.style?.stroke === 'string'
    ? toolbar.primaryNode.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const strokeWidthValue = typeof toolbar.primaryNode.style?.strokeWidth === 'number'
    ? toolbar.primaryNode.style.strokeWidth
    : 1
  const textValue = readTextValue(toolbar.primaryNode, primarySchema)
  const textFieldKey = readTextFieldKey(toolbar.primaryNode, primarySchema)
  const textColor = typeof toolbar.primaryNode.style?.color === 'string'
    ? toolbar.primaryNode.style.color
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const textFontSize = typeof toolbar.primaryNode.style?.fontSize === 'number'
    ? toolbar.primaryNode.style.fontSize
    : undefined
  const showTextSection = !primarySchema
    || hasSchemaField(primarySchema, 'data', 'text')
    || hasSchemaField(primarySchema, 'data', 'title')
  const showTextColorSection = !primarySchema
    || hasSchemaField(primarySchema, 'style', 'color')
  const showTextFontSizeSection = !primarySchema
    || hasSchemaField(primarySchema, 'style', 'fontSize')
  const showGroupCollapsed = !primarySchema
    || hasSchemaField(primarySchema, 'data', 'collapsed')
  const showGroupAutoFit = !primarySchema
    || hasSchemaField(primarySchema, 'data', 'autoFit')
  const groupCollapsed = Boolean(toolbar.primaryNode.data?.collapsed)
  const groupAutoFit: GroupAutoFitMode =
    toolbar.primaryNode.data?.autoFit === 'manual'
      ? 'manual'
      : 'expand-only'

  const renderMenu = () => {
    if (!activeMenuKey) return null

    switch (activeMenuKey) {
      case 'fill':
        return (
          <FillMenu
            value={fillValue}
            onChange={(value) => {
              updateNodesStyle(instance, toolbar.nodes, { fill: value })
              const stickyNodes = toolbar.nodes.filter((node) => node.type === 'sticky')
              if (!stickyNodes.length) {
                return
              }
              instance.commands.node.updateMany(stickyNodes.map((node) => ({
                id: node.id,
                patch: {
                  data: mergeData(node.data, { background: value })
                }
              })))
            }}
          />
        )
      case 'stroke':
        return (
          <StrokeMenu
            stroke={strokeValue}
            strokeWidth={strokeWidthValue}
            onStrokeChange={(value) => {
              updateNodesStyle(instance, toolbar.nodes, { stroke: value })
            }}
            onStrokeWidthChange={(value) => {
              updateNodesStyle(instance, toolbar.nodes, { strokeWidth: value })
            }}
          />
        )
      case 'text':
        return (
          <TextMenu
            value={textValue}
            color={textColor}
            fontSize={textFontSize}
            showText={showTextSection}
            showColor={showTextColorSection}
            showFontSize={showTextFontSizeSection}
            onTextCommit={showTextSection ? (value) => {
              updateToolbarTextNode({
                instance,
                container: containerRef.current,
                node: toolbar.primaryNode,
                field: textFieldKey,
                value
              })
            } : undefined}
            onColorChange={showTextColorSection ? (value) => {
              updateNodeStyle(instance, toolbar.primaryNode, { color: value })
            } : undefined}
            onFontSizeChange={showTextFontSizeSection ? (value) => {
              updateToolbarTextFontSize({
                instance,
                container: containerRef.current,
                node: toolbar.primaryNode,
                field: textFieldKey,
                value
              })
            } : undefined}
          />
        )
      case 'group':
        return (
          <GroupMenu
            collapsed={groupCollapsed}
            autoFit={groupAutoFit}
            showCollapsed={showGroupCollapsed}
            showAutoFit={showGroupAutoFit}
            onToggleCollapsed={showGroupCollapsed ? () => {
              void updateGroupNode(instance, toolbar.primaryNode.id, {
                collapsed: !groupCollapsed
              })
            } : undefined}
            onAutoFitChange={showGroupAutoFit ? (value) => {
              void updateGroupNode(instance, toolbar.primaryNode.id, {
                autoFit: value
              })
            } : undefined}
          />
        )
      case 'arrange':
        return (
          <ArrangeMenu
            onBringToFront={() => {
              closeAfter(arrangeNodes(instance, nodeIds, 'front'), closeMenu)
            }}
            onBringForward={() => {
              closeAfter(arrangeNodes(instance, nodeIds, 'forward'), closeMenu)
            }}
            onSendBackward={() => {
              closeAfter(arrangeNodes(instance, nodeIds, 'backward'), closeMenu)
            }}
            onSendToBack={() => {
              closeAfter(arrangeNodes(instance, nodeIds, 'back'), closeMenu)
            }}
          />
        )
      case 'more':
        return (
          <MoreMenu
            canDuplicate={summary.count > 0}
            canDelete={summary.count > 0}
            onDuplicate={() => {
              closeAfter(duplicateNodes(instance, nodeIds), closeMenu)
            }}
            onDelete={() => {
              closeAfter(deleteNodes(instance, nodeIds), closeMenu)
            }}
          />
        )
    }
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
          const active = item.active || activeMenuKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              className="wb-node-toolbar-button"
              data-active={active ? 'true' : undefined}
              title={item.label}
              ref={(element) => {
                if (isToolbarMenuKey(item.key)) {
                  buttonRefByKey.current[item.key] = element
                }
              }}
              data-selection-ignore
              data-input-ignore
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={() => {
                if (item.key === 'lock') {
                  closeAfter(toggleNodesLock(instance, toolbar.nodes, summary), closeMenu)
                  return
                }
                if (!isToolbarMenuKey(item.key)) return
                setActiveMenuKey((current) => current === item.key ? null : item.key)
              }}
            >
              {ToolbarIcons[item.key]}
            </button>
          )
        })}
      </div>
      {menuStyle && activeMenuKey ? (
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
          {renderMenu()}
        </div>
      ) : null}
    </div>
  )
}
