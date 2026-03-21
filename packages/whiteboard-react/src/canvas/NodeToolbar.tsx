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
  type GroupAutoFitMode,
  mergeNodeStyle,
  removeNodeStyle,
  removeNodeStyleKey,
  updateNodeStyle,
  updateNodesStyle,
  updateGroupNode
} from '../features/node/commands'
import {
  createNodeSelectionActions,
  type NodeActionItem,
  type NodeSelectionActions
} from '../features/node/actions'
import {
  copyNodes,
  cutNodes,
  closeAfter
} from './actions'
import {
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_PLACEHOLDER,
  measureTextNodeSize,
} from '../features/node/text'
import { FillMenu } from './menus/FillMenu'
import { GroupMenu } from './menus/GroupMenu'
import { LayoutMenu } from './menus/LayoutMenu'
import { MoreMenu, type MoreMenuSection } from './menus/MoreMenu'
import { DRAW_STROKE_WIDTHS } from './menus/options'
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
  | 'layout'
  | 'more'

type ToolbarMenuKey = ToolbarItemKey
type ToolbarPlacement = 'top' | 'bottom'

type ToolbarItem = {
  key: ToolbarItemKey
  label: string
  active: boolean
}

type ToolbarIconState = {
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

type ToolbarModel = {
  items: readonly ToolbarItem[]
  actions: NodeSelectionActions
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

const StaticItemKeys: readonly ToolbarItemKey[] = [
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

const resolveItemKeys = (
  actions: NodeSelectionActions,
  count: number
): ToolbarItemKey[] => [
  ...(count > 1 && actions.can.align ? ['layout'] as const : []),
  ...(actions.can.fill ? ['fill'] as const : []),
  ...(actions.can.stroke ? ['stroke'] as const : []),
  ...(actions.can.text ? ['text'] as const : []),
  ...(actions.can.group ? ['group'] as const : []),
  ...StaticItemKeys
]

const buildToolbarItem = (
  key: ToolbarItemKey
): ToolbarItem => (
  {
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
              : key === 'layout'
                ? 'Layout'
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

const resolveToolbarStrokePreviewWidth = (
  value?: number
) => {
  if (!Number.isFinite(value)) {
    return 2
  }

  return Math.min(4.5, Math.max(1.5, value as number))
}

const renderToolbarIcon = (
  key: ToolbarItemKey,
  state: ToolbarIconState
): ReactNode => {
  switch (key) {
    case 'fill':
      return (
        <SvgIcon>
          <path d="M8 5.5h6l3.5 3.5v1L11 17.5 6.5 13l7-7.5Z" stroke="currentColor" strokeWidth={IconStrokeWidth} />
          <path
            d="M5.5 19.5h13"
            stroke={state.fill ?? 'currentColor'}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </SvgIcon>
      )
    case 'stroke':
      return (
        <SvgIcon>
          <path
            d="M5 18.5h14"
            stroke={state.stroke ?? 'currentColor'}
            strokeOpacity={state.opacity ?? 1}
            strokeWidth={resolveToolbarStrokePreviewWidth(state.strokeWidth)}
            strokeLinecap="round"
          />
          <path d="M5 7h14" stroke="currentColor" strokeWidth={IconStrokeWidth} />
        </SvgIcon>
      )
    case 'text':
      return (
        <SvgIcon>
          <path d="M7 6.5h10" stroke="currentColor" strokeWidth={IconStrokeWidth} />
          <path d="M12 6.5v11" stroke="currentColor" strokeWidth={IconStrokeWidth} />
        </SvgIcon>
      )
    case 'group':
      return (
        <SvgIcon>
          <rect x="4.5" y="6.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
          <rect x="12.5" y="10.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={IconStrokeWidth} />
        </SvgIcon>
      )
    case 'layout':
      return (
        <SvgIcon>
          <path d="M4.5 7h15" stroke="currentColor" strokeWidth={IconStrokeWidth} />
          <path d="M12 4.5v15" stroke="currentColor" strokeWidth={IconStrokeWidth} />
          <rect x="6" y="9" width="4" height="3" rx="0.75" stroke="currentColor" strokeWidth={IconStrokeWidth} />
          <rect x="14" y="9" width="4" height="6" rx="0.75" stroke="currentColor" strokeWidth={IconStrokeWidth} />
        </SvgIcon>
      )
    case 'more':
      return (
        <SvgIcon>
          <circle cx="7" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="17" cy="12" r="1.15" fill="currentColor" stroke="none" />
        </SvgIcon>
      )
  }
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

const mergeData = (
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
) => mergeRecordPatch(current, patch)

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

const readMoreMenuSections = (
  actions: NodeSelectionActions,
  close: () => void
): MoreMenuSection[] => {
  const bindItems = (
    items: readonly NodeActionItem[]
  ) => items.map((item) => ({
    ...item,
    onClick: () => {
      closeAfter(item.onClick(), close)
    }
  }))

  return actions.sections
    .filter((section) => section.key !== 'layout')
    .map((section) => ({
      key: section.key,
      title: section.title,
      items: bindItems(section.items)
    }))
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
    ? measureTextNodeSize({
        node,
        content: value,
        placeholder: TEXT_PLACEHOLDER,
        source,
        width: committedRect.width
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
    ? removeNodeStyleKey(node.style, 'fontSize')
    : mergeNodeStyle(node.style, { fontSize: value })
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
    ? measureTextNodeSize({
        node,
        content: textValue,
        placeholder: TEXT_PLACEHOLDER,
        source,
        width: committedRect.width,
        fontSize: value ?? TEXT_DEFAULT_FONT_SIZE
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
  const summary = selection.summary
  let toolbar: ToolbarModel | undefined

  if (rect && primaryNode && nodes.length) {
    const actions = createNodeSelectionActions(instance, nodes, {
      summary,
      can: selection.can,
      onCopy: () => copyNodes(instance, nodes.map((node) => node.id)),
      onCut: () => cutNodes(instance, nodes.map((node) => node.id))
    })
    const items = resolveItemKeys(actions, nodes.length).map((key) => buildToolbarItem(key))

    if (items.length) {
      const { placement, anchor } = resolveToolbarPlacement({
        worldToScreen,
        rect
      })

      toolbar = {
        items,
        actions,
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

  const actions = toolbar.actions
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
  const strokeOpacityValue = typeof toolbar.primaryNode.style?.opacity === 'number'
    ? toolbar.primaryNode.style.opacity
    : undefined
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
  const showStrokeOpacitySection =
    hasSchemaField(primarySchema, 'style', 'opacity')
    || typeof toolbar.primaryNode.style?.opacity === 'number'
  const drawOnlyStrokeMenu = toolbar.nodes.every((node) => node.type === 'draw')
  const groupCollapsed = Boolean(toolbar.primaryNode.data?.collapsed)
  const groupAutoFit: GroupAutoFitMode =
    toolbar.primaryNode.data?.autoFit === 'manual'
      ? 'manual'
      : 'expand-only'
  const toolbarIconState: ToolbarIconState = {
    fill: fillValue,
    stroke: strokeValue,
    strokeWidth: strokeWidthValue,
    opacity: strokeOpacityValue
  }

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
            widths={drawOnlyStrokeMenu ? DRAW_STROKE_WIDTHS : undefined}
            stroke={strokeValue}
            strokeWidth={strokeWidthValue}
            opacity={strokeOpacityValue}
            onStrokeChange={(value) => {
              updateNodesStyle(instance, toolbar.nodes, { stroke: value })
            }}
            onStrokeWidthChange={(value) => {
              updateNodesStyle(instance, toolbar.nodes, { strokeWidth: value })
            }}
            onOpacityChange={showStrokeOpacitySection ? (value) => {
              updateNodesStyle(instance, toolbar.nodes, { opacity: value })
            } : undefined}
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
      case 'layout':
        return (
          <LayoutMenu
            canAlign={actions.layout.canAlign}
            canDistribute={actions.layout.canDistribute}
            onAlign={(mode) => {
              closeAfter(actions.layout.onAlign(mode), closeMenu)
            }}
            onDistribute={(mode) => {
              closeAfter(actions.layout.onDistribute(mode), closeMenu)
            }}
          />
        )
      case 'more':
        return (
          <MoreMenu
            summary={toolbar.nodes.length > 1
              ? actions.summary
              : undefined}
            filter={actions.filter.visible
              ? {
                  types: actions.filter.types,
                  onSelect: (type) => {
                    closeAfter(actions.filter.onSelect(type), closeMenu)
                  }
                }
              : undefined}
            sections={readMoreMenuSections(actions, closeMenu)}
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
                buttonRefByKey.current[item.key] = element
              }}
              data-selection-ignore
              data-input-ignore
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={() => {
                setActiveMenuKey((current) => current === item.key ? null : item.key)
              }}
            >
              {renderToolbarIcon(item.key, toolbarIconState)}
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
