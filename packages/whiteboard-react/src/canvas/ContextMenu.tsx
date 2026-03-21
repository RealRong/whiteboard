import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import {
  useInternalInstance
} from '../runtime/hooks'
import {
  leave,
  hasEdge,
  hasNode
} from '../runtime/container'
import {
  createNodeSelectionActions
} from '../features/node/actions'
import {
  summarizeNodes,
  type NodeSummary,
  type NodeTypeSummary
} from '../features/node/summary'
import {
  type GroupAutoFitMode,
  updateGroupNode
} from '../features/node/commands'
import {
  CREATE_NODE_PRESETS,
  closeAfter,
  copyEdge,
  copyNodes,
  createNodeFromPreset,
  cutEdge,
  cutNodes,
  pasteClipboard,
  selectAllInScope
} from './actions'
import {
  COLOR_OPTIONS,
  DRAW_STROKE_WIDTHS,
  OPACITY_OPTIONS,
  STROKE_WIDTHS
} from './menus/options'
import {
  isContextMenuIgnoredTarget,
  readElementEdgeId,
  readElementNodeId
} from './target'
import { SelectionSummaryHeader } from '../features/node/components/SelectionSummaryHeader'
import { SelectionTypeFilterStrip } from '../features/node/components/SelectionTypeFilterStrip'
import { readContainerBodyTarget } from '../features/node/scene'
import { updateNodesStyle } from '../features/node/style'

type Surface = {
  width: number
  height: number
}

type ContextMenuTone = 'default' | 'danger'

type ContextMenuItem = {
  key: string
  label: string
  tone?: ContextMenuTone
  disabled?: boolean
  onClick?: () => void
  children?: readonly ContextMenuItem[]
}

type ContextMenuGroup = {
  key: string
  title?: string
  items: readonly ContextMenuItem[]
}

type ContextMenuFilter = {
  types: readonly NodeTypeSummary[]
  onSelect: (type: string) => void
}

type ContextMenuView = {
  summary?: NodeSummary
  filter?: ContextMenuFilter
  groups: readonly ContextMenuGroup[]
}

type ContextMenuTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextMenuSelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeId?: EdgeId
}

type ContextMenuSession = {
  screen: Point
  target: ContextMenuTarget
  selection: ContextMenuSelectionSnapshot
} | null

type ContextMenuResolvedTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: WhiteboardNode; world: Point }
  | { kind: 'nodes'; nodes: readonly WhiteboardNode[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextMenuSide = 'left' | 'right'

const ShouldIgnoreDuplicateMs = 300
const DuplicateDistance = 4
const MenuWidth = 220
const MenuSafeMargin = 12

const snapshotSelection = (
  nodeIds: readonly NodeId[],
  edgeId?: EdgeId
): ContextMenuSelectionSnapshot => ({
  nodeIds,
  edgeId
})

const restoreSelection = (
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands'>,
  selection: ContextMenuSelectionSnapshot
) => {
  if (selection.edgeId !== undefined) {
    instance.commands.selection.selectEdge(selection.edgeId)
    return
  }

  if (selection.nodeIds.length > 0) {
    instance.commands.selection.replace(selection.nodeIds)
    return
  }

  instance.commands.selection.clear()
}

const isDuplicateContextMenuOpen = (
  prev: { x: number; y: number; time: number } | null,
  next: { x: number; y: number; time: number }
) => {
  if (!prev) return false
  if (next.time - prev.time > ShouldIgnoreDuplicateMs) return false
  return (
    Math.abs(prev.x - next.x) <= DuplicateDistance
    && Math.abs(prev.y - next.y) <= DuplicateDistance
  )
}

const resolveContextMenuTarget = (
  instance: Pick<ReturnType<typeof useInternalInstance>, 'read'>,
  target: ContextMenuTarget
): ContextMenuResolvedTarget | undefined => {
  switch (target.kind) {
    case 'canvas':
      return target
    case 'node': {
      const entry = instance.read.node.item.get(target.nodeId)
      if (!entry) return undefined
      return {
        kind: 'node',
        node: entry.node,
        world: target.world
      }
    }
    case 'nodes': {
      const nodes = target.nodeIds
        .map((nodeId) => instance.read.node.item.get(nodeId)?.node)
        .filter((node): node is NonNullable<typeof node> => Boolean(node))

      if (!nodes.length) return undefined

      return {
        kind: 'nodes',
        nodes,
        world: target.world
      }
    }
    case 'edge': {
      const entry = instance.read.edge.item.get(target.edgeId)
      if (!entry) return undefined
      return {
        kind: 'edge',
        edgeId: entry.edge.id,
        world: target.world
      }
    }
  }
}

const isPointInRect = (
  point: Point,
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

const hasStyleField = (
  schema: NodeSchema | undefined,
  path: string
) => schema?.fields.some((field) => field.scope === 'style' && field.path === path) ?? false

const canEditStrokeStyle = (
  node: WhiteboardNode,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'stroke')
  || hasStyleField(schema, 'strokeWidth')
  || typeof node.style?.stroke === 'string'
  || typeof node.style?.strokeWidth === 'number'
)

const canEditOpacityStyle = (
  node: WhiteboardNode,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'opacity')
  || typeof node.style?.opacity === 'number'
)

const withCurrentLabel = (
  label: string,
  active: boolean
) => active ? `${label} (Current)` : label

const buildStrokeStyleGroup = ({
  instance,
  nodes
}: {
  instance: Pick<ReturnType<typeof useInternalInstance>, 'registry' | 'commands'>
  nodes: readonly WhiteboardNode[]
}): ContextMenuGroup | undefined => {
  if (!nodes.length) {
    return undefined
  }

  const sources = nodes.map((node) => ({
    node,
    schema: instance.registry.get(node.type)?.schema
  }))
  const supportsStroke = sources.every(({ node, schema }) => canEditStrokeStyle(node, schema))
  if (!supportsStroke) {
    return undefined
  }

  const supportsOpacity = sources.every(({ node, schema }) => canEditOpacityStyle(node, schema))
  const strokeWidths = nodes.every((node) => node.type === 'draw')
    ? DRAW_STROKE_WIDTHS
    : STROKE_WIDTHS
  const primary = nodes[0]
  const stroke = typeof primary.style?.stroke === 'string'
    ? primary.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const strokeWidth = typeof primary.style?.strokeWidth === 'number'
    ? primary.style.strokeWidth
    : 1
  const opacity = typeof primary.style?.opacity === 'number'
    ? primary.style.opacity
    : 1

  return {
    key: 'style',
    title: 'Style',
    items: [
      {
        key: 'style.stroke',
        label: 'Stroke',
        children: COLOR_OPTIONS.map((option) => ({
          key: `style.stroke.${option.label.toLowerCase()}`,
          label: withCurrentLabel(option.label, stroke === option.value),
          onClick: () => {
            updateNodesStyle(instance, nodes, { stroke: option.value })
          }
        }))
      },
      {
        key: 'style.width',
        label: 'Width',
        children: strokeWidths.map((value) => ({
          key: `style.width.${value}`,
          label: withCurrentLabel(`${value}`, strokeWidth === value),
          onClick: () => {
            updateNodesStyle(instance, nodes, { strokeWidth: value })
          }
        }))
      },
      ...(supportsOpacity
        ? [
          {
            key: 'style.opacity',
            label: 'Opacity',
            children: OPACITY_OPTIONS.map((option) => ({
              key: `style.opacity.${option.label}`,
              label: withCurrentLabel(option.label, opacity === option.value),
              onClick: () => {
                updateNodesStyle(instance, nodes, { opacity: option.value })
              }
            }))
          }
        ]
        : [])
    ]
  }
}

const readPlacement = ({
  screen,
  containerWidth,
  containerHeight
}: {
  screen: Point
  containerWidth: number
  containerHeight: number
}) => {
  const left = Math.min(
    Math.max(MenuSafeMargin, screen.x),
    Math.max(MenuSafeMargin, containerWidth - MenuSafeMargin)
  )
  const top = Math.min(
    Math.max(MenuSafeMargin, screen.y),
    Math.max(MenuSafeMargin, containerHeight - MenuSafeMargin)
  )

  const alignRight = left + MenuWidth > containerWidth - MenuSafeMargin
  const alignBottom = top + 280 > containerHeight - MenuSafeMargin

  return {
    left,
    top,
    transform: `${alignRight ? 'translateX(-100%)' : ''} ${alignBottom ? 'translateY(-100%)' : ''}`.trim(),
    submenuSide: alignRight ? 'left' as const : 'right' as const
  }
}

const bindContextMenuItems = (
  items: readonly ContextMenuItem[],
  close: () => void
): ContextMenuItem[] => (
  items.map((item) => ({
    ...item,
    onClick: item.onClick
      ? () => {
        closeAfter(item.onClick?.(), close)
      }
      : undefined,
    children: item.children
      ? bindContextMenuItems(item.children, close)
      : undefined
  }))
)

const bindContextMenuGroups = (
  groups: readonly ContextMenuGroup[],
  close: () => void
): ContextMenuGroup[] => (
  groups.map((group) => ({
    ...group,
    items: bindContextMenuItems(group.items, close)
  }))
)

const bindContextMenuFilter = (
  filter: ContextMenuFilter | undefined,
  close: () => void
): ContextMenuFilter | undefined => {
  if (!filter) {
    return undefined
  }

  return {
    ...filter,
    onSelect: (type) => {
      closeAfter(filter.onSelect(type), close)
    }
  }
}

const readActionContextMenuGroups = (
  actions: ReturnType<typeof createNodeSelectionActions>
): ContextMenuGroup[] => {
  const groups: ContextMenuGroup[] = []

  if (actions.layout.visible) {
    groups.push({
      key: 'layout',
      items: [
        {
          key: 'layout.menu',
          label: 'Layout',
          children: [
            ...actions.layout.alignItems,
            ...actions.layout.distributeItems
          ]
        }
      ]
    })
  }

  if (actions.layer.visible) {
    groups.push({
      key: 'layer',
      items: [
        {
          key: 'layer.menu',
          label: 'Layer',
          children: actions.layer.items
        }
      ]
    })
  }

  if (actions.structure.visible) {
    groups.push({
      key: 'structure',
      items: actions.structure.items
    })
  }

  if (actions.state.visible) {
    groups.push({
      key: 'state',
      items: actions.state.items
    })
  }

  if (actions.edit.visible) {
    groups.push({
      key: 'edit',
      items: actions.edit.items
    })
  }

  if (actions.danger.visible) {
    groups.push({
      key: 'danger',
      items: actions.danger.items
    })
  }

  return groups
}

const readContextMenuOpenResult = ({
  instance,
  targetElement,
  screen,
  world
}: {
  instance: Pick<ReturnType<typeof useInternalInstance>, 'read' | 'state' | 'registry'>
  targetElement: Element | null
  screen: Point
  world: Point
}): {
  target: ContextMenuTarget
  leaveContainer: boolean
} | undefined => {
  const container = instance.state.container.get()
  const selection = instance.read.selection.get()
  const nodeId = readElementNodeId(targetElement)

  if (nodeId) {
    return {
      target: selection.target.nodeSet.has(nodeId) && selection.items.count > 1
        ? {
          kind: 'nodes',
          nodeIds: selection.target.nodeIds,
          world
        }
        : {
          kind: 'node',
          nodeId,
          world
        },
      leaveContainer: !hasNode(container, nodeId)
    }
  }

  const edgeId = readElementEdgeId(targetElement)
  if (edgeId) {
    const entry = instance.read.edge.item.get(edgeId)
    if (!entry) return undefined

    return {
      target: {
        kind: 'edge',
        edgeId,
        world
      },
      leaveContainer: !hasEdge(container, entry.edge)
    }
  }

  const activeRect = container.id
    ? instance.read.index.node.get(container.id)?.rect
    : undefined
  const insideActiveContainer = Boolean(
    activeRect && isPointInRect(world, activeRect)
  )

  if (!insideActiveContainer) {
    const containerNodeId = readContainerBodyTarget(instance, world)
    if (containerNodeId) {
      return {
        target: selection.target.nodeSet.has(containerNodeId) && selection.items.count > 1
          ? {
            kind: 'nodes',
            nodeIds: selection.target.nodeIds,
            world
          }
          : {
            kind: 'node',
            nodeId: containerNodeId,
            world
          },
        leaveContainer: !hasNode(container, containerNodeId)
      }
    }
  }

  return {
    target: {
      kind: 'canvas',
      world
    },
    leaveContainer: Boolean(container.id)
  }
}

export const ContextMenu = ({
  containerRef,
  surface
}: {
  containerRef: RefObject<HTMLDivElement | null>
  surface: Surface
}) => {
  const instance = useInternalInstance()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastOpenRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const [session, setSession] = useState<ContextMenuSession>(null)
  const [submenuKey, setSubmenuKey] = useState<string | null>(null)

  const dismiss = useCallback((mode: 'dismiss' | 'action') => {
    setSession((current) => {
      if (mode === 'dismiss' && current) {
        restoreSelection(instance, current.selection)
      }
      return null
    })
    setSubmenuKey(null)
  }, [instance])

  const dismissAction = useCallback(() => {
    dismiss('action')
  }, [dismiss])

  const open = useCallback((result: {
    target: ContextMenuTarget
    leaveContainer: boolean
    screen: Point
  }) => {
    if (result.leaveContainer) {
      leave(instance)
    }

    const selection = instance.read.selection.get()
    setSession({
      screen: result.screen,
      target: result.target,
      selection: snapshotSelection(
        selection.target.nodeIds,
        selection.target.edgeId
      )
    })
    setSubmenuKey(null)
  }, [instance])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const openFromEvent = (
      event: Pick<MouseEvent | PointerEvent, 'clientX' | 'clientY'>,
      targetElement: Element | null
    ) => {
      const pointer = instance.viewport.pointer(event)
      const result = readContextMenuOpenResult({
        instance,
        targetElement,
        screen: pointer.screen,
        world: pointer.world
      })
      if (!result) return

      lastOpenRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      }
      open({
        ...result,
        screen: pointer.screen
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return
      if (instance.interaction.mode.get() !== 'idle') return
      if (isContextMenuIgnoredTarget(event.target)) return

      const targetElement = event.target instanceof Element ? event.target : null
      event.preventDefault()
      event.stopPropagation()
      openFromEvent(event, targetElement)
    }

    const onContextMenu = (event: MouseEvent) => {
      if (instance.interaction.mode.get() !== 'idle') return
      if (isContextMenuIgnoredTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()

      if (isDuplicateContextMenuOpen(lastOpenRef.current, {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      })) {
        return
      }

      const targetElement = event.target instanceof Element ? event.target : null
      openFromEvent(event, targetElement)
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [containerRef, instance, open])

  const view = useMemo(() => {
    if (!session) return undefined

    const target = resolveContextMenuTarget(instance, session.target)
    if (!target) return undefined

    const buildGroupSection = (
      node: WhiteboardNode
    ): ContextMenuGroup => {
      const collapsed = Boolean(node.data?.collapsed)
      const autoFit: GroupAutoFitMode =
        node.data?.autoFit === 'manual'
          ? 'manual'
          : 'expand-only'

      return {
        key: 'group',
        title: 'Group',
        items: [
          {
            key: 'group.toggle-collapse',
            label: collapsed ? 'Expand' : 'Collapse',
            onClick: () => {
              closeAfter(updateGroupNode(instance, node.id, {
                collapsed: !collapsed
              }), dismissAction)
            }
          },
          {
            key: 'group.auto-fit-expand-only',
            label: autoFit === 'expand-only'
              ? 'Auto fit: expand-only'
              : 'Set auto fit: expand-only',
            onClick: () => {
              closeAfter(updateGroupNode(instance, node.id, {
                autoFit: 'expand-only'
              }), dismissAction)
            }
          },
          {
            key: 'group.auto-fit-manual',
            label: autoFit === 'manual'
              ? 'Auto fit: manual'
              : 'Set auto fit: manual',
            onClick: () => {
              closeAfter(updateGroupNode(instance, node.id, {
                autoFit: 'manual'
              }), dismissAction)
            }
          }
        ]
      }
    }

    const readMenu = (): ContextMenuView => {
      switch (target.kind) {
        case 'canvas': {
          const container = instance.state.container.get()
          return {
            groups: [
              {
                key: 'edit',
                title: 'Edit',
                items: [
                  {
                    key: 'edit.paste',
                    label: 'Paste',
                    onClick: () => pasteClipboard(instance, {
                      at: target.world,
                      parentId: container.id
                    })
                  }
                ]
              },
              {
                key: 'create',
                title: 'Create',
                items: CREATE_NODE_PRESETS.map((preset) => ({
                  key: preset.key,
                  label: preset.label,
                  onClick: () => {
                    closeAfter(
                      createNodeFromPreset(instance, preset, target.world, container.id),
                      dismissAction
                    )
                  }
                }))
              },
              {
                key: 'history',
                title: 'History',
                items: [
                  {
                    key: 'history.undo',
                    label: 'Undo',
                    onClick: () => {
                      instance.commands.history.undo()
                      dismissAction()
                    }
                  },
                  {
                    key: 'history.redo',
                    label: 'Redo',
                    onClick: () => {
                      instance.commands.history.redo()
                      dismissAction()
                    }
                  }
                ]
              },
              {
                key: 'selection',
                title: 'Selection',
                items: [
                  {
                    key: 'selection.select-all',
                    label: 'Select all',
                    onClick: () => {
                      selectAllInScope(instance)
                      dismissAction()
                    }
                  }
                ]
              }
            ]
          }
        }
        case 'node': {
          const summary = summarizeNodes([target.node], {
            resolveMeta: (type) => instance.registry.get(type)?.meta
          })
          const actions = createNodeSelectionActions(instance, [target.node], {
            summary,
            onCopy: () => copyNodes(instance, [target.node.id]),
            onCut: () => cutNodes(instance, [target.node.id])
          })
          const groups = readActionContextMenuGroups(actions)
          const styleGroup = buildStrokeStyleGroup({
            instance,
            nodes: [target.node]
          })
          if (styleGroup) {
            groups.unshift(styleGroup)
          }
          const boundGroups = bindContextMenuGroups(
            groups,
            dismissAction
          )
          if (target.node.type === 'group') {
            const groupSection = buildGroupSection(target.node)
            const structureIndex = boundGroups.findIndex((group) => group.key === 'structure')
            if (structureIndex >= 0) {
              boundGroups.splice(structureIndex + 1, 0, groupSection)
            } else {
              boundGroups.push(groupSection)
            }
          }
          return {
            filter: bindContextMenuFilter(
              actions.filter.visible
                ? {
                    types: actions.filter.types,
                    onSelect: actions.filter.onSelect
                  }
                : undefined,
              dismissAction
            ),
            groups: boundGroups
          }
        }
        case 'nodes': {
          const summary = summarizeNodes(target.nodes, {
            resolveMeta: (type) => instance.registry.get(type)?.meta
          })
          const actions = createNodeSelectionActions(instance, target.nodes, {
            summary,
            onCopy: () => copyNodes(instance, target.nodes.map((node) => node.id)),
            onCut: () => cutNodes(instance, target.nodes.map((node) => node.id))
          })
          const groups = readActionContextMenuGroups(actions)
          const styleGroup = buildStrokeStyleGroup({
            instance,
            nodes: target.nodes
          })
          if (styleGroup) {
            groups.unshift(styleGroup)
          }
          return {
            summary,
            filter: bindContextMenuFilter(
              actions.filter.visible
                ? {
                    types: actions.filter.types,
                    onSelect: actions.filter.onSelect
                  }
                : undefined,
              dismissAction
            ),
            groups: bindContextMenuGroups(
              groups,
              dismissAction
            )
          }
        }
        case 'edge':
          return {
            groups: [
              {
                key: 'edge.actions',
                items: [
                  {
                    key: 'edge.copy',
                    label: 'Copy',
                    onClick: () => copyEdge(instance, target.edgeId)
                  },
                  {
                    key: 'edge.cut',
                    label: 'Cut',
                    onClick: () => cutEdge(instance, target.edgeId)
                  },
                  {
                    key: 'edge.delete',
                    label: 'Delete',
                    tone: 'danger',
                    onClick: () => {
                      closeAfter(instance.commands.edge.delete([target.edgeId]), dismissAction)
                    }
                  }
                ]
              }
            ]
          }
      }
    }

    const menu = readMenu()

    return {
      placement: readPlacement({
        screen: session.screen,
        containerWidth: surface.width,
        containerHeight: surface.height
      }),
      filter: menu.filter,
      groups: menu.groups
    }
  }, [dismissAction, instance, session, surface.height, surface.width])

  useEffect(() => {
    if (!view) return

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) {
        return
      }
      dismiss('dismiss')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      dismiss('dismiss')
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dismiss, view])

  if (!view) return null

  const submenuSide: ContextMenuSide = view.placement.submenuSide
  const menuStyle = {
    left: view.placement.left,
    top: view.placement.top,
    transform: view.placement.transform
  }

  const renderLeafItem = (item: ContextMenuItem) => (
    <button
      key={item.key}
      type="button"
      className="wb-context-menu-item"
      data-tone={item.tone === 'danger' ? 'danger' : undefined}
      disabled={item.disabled}
      data-context-menu-item={item.key}
      onClick={item.onClick}
      onPointerEnter={() => {
        setSubmenuKey(null)
      }}
      onFocus={() => {
        setSubmenuKey(null)
      }}
      data-context-menu-ignore
      data-selection-ignore
      data-input-ignore
    >
      <span>{item.label}</span>
    </button>
  )

  const renderSubmenuItem = (item: ContextMenuItem) => {
    const open = submenuKey === item.key
    return (
      <div
        key={item.key}
        className="wb-context-menu-item-shell"
        data-open={open ? 'true' : undefined}
        onPointerEnter={() => {
          setSubmenuKey(item.key)
        }}
        onFocus={() => {
          setSubmenuKey(item.key)
        }}
        data-context-menu-ignore
      >
        <button
          type="button"
          className="wb-context-menu-item"
          aria-haspopup="menu"
          aria-expanded={open}
          data-context-menu-item={item.key}
          data-context-menu-ignore
          data-selection-ignore
          data-input-ignore
        >
          <span>{item.label}</span>
          <span className="wb-context-menu-item-caret" aria-hidden="true">›</span>
        </button>
        {open && item.children?.length ? (
          <div
            className="wb-context-submenu"
            data-side={submenuSide}
            data-context-menu-ignore
            data-selection-ignore
            data-input-ignore
          >
            {item.children.map((child) => renderLeafItem(child))}
          </div>
        ) : null}
      </div>
    )
  }

  const renderGroup = (group: ContextMenuGroup) => (
    <div key={group.key} className="wb-context-menu-section">
      {group.title ? (
        <div className="wb-context-menu-section-title">{group.title}</div>
      ) : null}
      {group.items.map((item) => (
        item.children?.length
          ? renderSubmenuItem(item)
          : renderLeafItem(item)
      ))}
    </div>
  )

  return (
    <div className="wb-context-menu-layer" ref={rootRef} data-context-menu-ignore>
      <div
        className="wb-context-menu"
        style={menuStyle}
        data-context-menu-ignore
        data-selection-ignore
        data-input-ignore
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onPointerLeave={() => {
          setSubmenuKey(null)
        }}
      >
        {view.summary ? (
          <SelectionSummaryHeader summary={view.summary} />
        ) : null}
        {view.filter ? (
          <div className="wb-context-menu-section">
            <div className="wb-context-menu-section-title">Filter</div>
            <SelectionTypeFilterStrip
              types={view.filter.types}
              onSelect={view.filter.onSelect}
            />
          </div>
        ) : null}
        {view.groups.map((group) => renderGroup(group))}
      </div>
    </div>
  )
}
