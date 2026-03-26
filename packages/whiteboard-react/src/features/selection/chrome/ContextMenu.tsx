import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import {
  useElementSize,
  useInternalInstance
} from '../../../runtime/hooks'
import type { InternalInstance } from '../../../runtime/instance'
import {
  createNodeSelectionActions
} from '../../node/actions'
import {
  type NodeSummary
} from '../../node/summary'
import {
  toNodeStyleUpdates
} from '../../node/patch'
import {
  copy,
  cut,
  paste
} from '../actions/clipboard'
import {
  CREATE_PRESETS,
} from '../../toolbox/presets'
import { insertPreset } from '../../toolbox/insert'
import {
  COLOR_OPTIONS,
  DRAW_STROKE_WIDTHS,
  OPACITY_OPTIONS,
  STROKE_WIDTHS
} from './menus/options'
import { isContextMenuIgnoredTarget } from '../../../runtime/input/target'
import {
  readContextOpen,
  resolveContextTarget,
  type ContextTarget
} from '../../../runtime/input/pointer'
import {
  SelectionSummaryHeader,
  SelectionTypeFilterStrip
} from '../../node/components/SelectionSummaryHeader'
import {
  bindNodeMenuGroup,
  readNodeContextMenuGroups,
  readNodeMenuFilter,
  type NodeMenuFilter,
  type NodeMenuGroup,
  type NodeMenuItem
} from './menuModel'

type ContextMenuView = {
  summary?: NodeSummary
  filter?: NodeMenuFilter
  groups: readonly NodeMenuGroup[]
}

type ContextMenuSelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

type ContextMenuSession = {
  screen: Point
  target: ContextTarget
  selection: ContextMenuSelectionSnapshot
} | null

type ContextMenuSide = 'left' | 'right'
type ContextMenuInstance = Pick<
  InternalInstance,
  'commands' | 'read' | 'state' | 'registry' | 'viewport'
>
type ContextMenuRenderState = {
  submenuKey: string | null
  submenuSide: ContextMenuSide
  openSubmenu: (key: string) => void
  clearSubmenu: () => void
}

const ShouldIgnoreDuplicateMs = 300
const DuplicateDistance = 4
const MenuWidth = 220
const MenuSafeMargin = 12
const MenuIgnoreAttrs = {
  'data-context-menu-ignore': '',
  'data-selection-ignore': '',
  'data-input-ignore': ''
} as const

const snapshotSelection = (
  nodeIds: readonly NodeId[],
  edgeIds: readonly EdgeId[]
): ContextMenuSelectionSnapshot => ({
  nodeIds,
  edgeIds
})

const restoreSelection = (
  instance: Pick<InternalInstance, 'commands'>,
  selection: ContextMenuSelectionSnapshot
) => {
  if (selection.nodeIds.length > 0 || selection.edgeIds.length > 0) {
    instance.commands.selection.replace({
      nodeIds: selection.nodeIds,
      edgeIds: selection.edgeIds
    })
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
  instance: Pick<ContextMenuInstance, 'registry' | 'commands'>
  nodes: readonly WhiteboardNode[]
}): NodeMenuGroup | undefined => {
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
            instance.commands.node.updateMany(
              toNodeStyleUpdates(nodes, { stroke: option.value })
            )
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
            instance.commands.node.updateMany(
              toNodeStyleUpdates(nodes, { strokeWidth: value })
            )
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
                instance.commands.node.updateMany(
                  toNodeStyleUpdates(nodes, { opacity: option.value })
                )
              }
            }))
          }
        ]
        : [])
    ]
  }
}

const readCanvasMenuView = ({
  instance,
  world,
  close
}: {
  instance: ContextMenuInstance
  world: Point
  close: () => void
}): ContextMenuView => {
  const frame = instance.state.frame.get()

  return {
    groups: [
      bindNodeMenuGroup({
        key: 'edit',
        title: 'Edit',
        items: [
          {
            key: 'edit.paste',
            label: 'Paste',
            onClick: () => paste(instance, {
              at: world,
              ownerId: frame.id
            })
          }
        ]
      }, close),
      bindNodeMenuGroup({
        key: 'create',
        title: 'Create',
        items: CREATE_PRESETS.map((preset) => ({
          key: preset.key,
          label: preset.label,
          onClick: () => insertPreset({
            instance,
            preset,
            world,
            ownerId: frame.id
          })
        }))
      }, close),
      bindNodeMenuGroup({
        key: 'history',
        title: 'History',
        items: [
          {
            key: 'history.undo',
            label: 'Undo',
            onClick: () => instance.commands.history.undo()
          },
          {
            key: 'history.redo',
            label: 'Redo',
            onClick: () => instance.commands.history.redo()
          }
        ]
      }, close),
      bindNodeMenuGroup({
        key: 'selection',
        title: 'Selection',
        items: [
          {
            key: 'selection.select-all',
            label: 'Select all',
            onClick: () => instance.commands.selection.selectAll()
          }
        ]
      }, close)
    ]
  }
}

const readNodeMenuView = ({
  instance,
  nodes,
  close
}: {
  instance: ContextMenuInstance
  nodes: readonly WhiteboardNode[]
  close: () => void
}): ContextMenuView => {
  const nodeIds = nodes.map((node) => node.id)
  const actions = createNodeSelectionActions(instance, nodes, {
    onCopy: () => copy(instance, {
      nodeIds
    }),
    onCut: () => cut(instance, {
      nodeIds
    })
  })
  const styleGroup = buildStrokeStyleGroup({
    instance,
    nodes
  })

  return {
    summary: nodes.length > 1 ? actions.summary : undefined,
    filter: readNodeMenuFilter(actions, close),
    groups: [
      ...(styleGroup ? [bindNodeMenuGroup(styleGroup, close)] : []),
      ...readNodeContextMenuGroups(actions, close)
    ]
  }
}

const readEdgeMenuView = ({
  instance,
  edgeId,
  close
}: {
  instance: ContextMenuInstance
  edgeId: EdgeId
  close: () => void
}): ContextMenuView => ({
  groups: [
    bindNodeMenuGroup({
      key: 'edge.actions',
      items: [
        {
          key: 'edge.copy',
          label: 'Copy',
          onClick: () => copy(instance, {
            edgeIds: [edgeId]
          })
        },
        {
          key: 'edge.cut',
          label: 'Cut',
          onClick: () => cut(instance, {
            edgeIds: [edgeId]
          })
        },
        {
          key: 'edge.delete',
          label: 'Delete',
          tone: 'danger',
          onClick: () => instance.commands.edge.delete([edgeId])
        }
      ]
    }, close)
  ]
})

const readContextMenuView = ({
  instance,
  target,
  close
}: {
  instance: ContextMenuInstance
  target: ReturnType<typeof resolveContextTarget>
  close: () => void
}): ContextMenuView | undefined => {
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'canvas':
      return readCanvasMenuView({
        instance,
        world: target.world,
        close
      })
    case 'node':
      return readNodeMenuView({
        instance,
        nodes: [target.node],
        close
      })
    case 'nodes':
      return readNodeMenuView({
        instance,
        nodes: target.nodes,
        close
      })
    case 'edge':
      return readEdgeMenuView({
        instance,
        edgeId: target.edgeId,
        close
      })
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

const ContextMenuItemView = ({
  item,
  state
}: {
  item: NodeMenuItem
  state: ContextMenuRenderState
}) => {
  const open = state.submenuKey === item.key
  const children = item.children?.length

  if (!children) {
    return (
      <button
        key={item.key}
        type="button"
        className="wb-context-menu-item"
        data-tone={item.tone === 'danger' ? 'danger' : undefined}
        disabled={item.disabled}
        data-context-menu-item={item.key}
        onClick={item.onClick}
        onPointerEnter={state.clearSubmenu}
        onFocus={state.clearSubmenu}
        {...MenuIgnoreAttrs}
      >
        <span>{item.label}</span>
      </button>
    )
  }

  return (
    <div
      key={item.key}
      className="wb-context-menu-item-shell"
      data-open={open ? 'true' : undefined}
      onPointerEnter={() => {
        state.openSubmenu(item.key)
      }}
      onFocus={() => {
        state.openSubmenu(item.key)
      }}
      data-context-menu-ignore
    >
      <button
        type="button"
        className="wb-context-menu-item"
        aria-haspopup="menu"
        aria-expanded={open}
        data-context-menu-item={item.key}
        {...MenuIgnoreAttrs}
      >
        <span>{item.label}</span>
        <span className="wb-context-menu-item-caret" aria-hidden="true">›</span>
      </button>
      {open ? (
        <div
          className="wb-context-submenu"
          data-side={state.submenuSide}
          {...MenuIgnoreAttrs}
        >
          {item.children?.map((child) => (
            <ContextMenuItemView
              key={child.key}
              item={child}
              state={state}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const ContextMenuGroupView = ({
  group,
  state
}: {
  group: NodeMenuGroup
  state: ContextMenuRenderState
}) => (
  <div className="wb-context-menu-section">
    {group.title ? (
      <div className="wb-context-menu-section-title">{group.title}</div>
    ) : null}
    {group.items.map((item) => (
      <ContextMenuItemView
        key={item.key}
        item={item}
        state={state}
      />
    ))}
  </div>
)

export const ContextMenu = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const surface = useElementSize(containerRef)
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
    target: ContextTarget
    leaveFrame: boolean
    screen: Point
  }) => {
    if (result.leaveFrame) {
      instance.commands.frame.exit()
    }

    const selection = instance.read.selection.get()
    setSession({
      screen: result.screen,
      target: result.target,
      selection: snapshotSelection(
        selection.target.nodeIds,
        selection.target.edgeIds
      )
    })
    setSubmenuKey(null)
  }, [instance])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const openFromEvent = (
      event: Pick<MouseEvent | PointerEvent, 'target' | 'clientX' | 'clientY'>
    ) => {
      const input = instance.read.pick.from(event, container)
      const result = readContextOpen(instance, input)
      if (!result) return

      lastOpenRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      }
      open({
        ...result,
        screen: input.point.screen
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return
      if (instance.interaction.busy.get()) return
      if (isContextMenuIgnoredTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()
      openFromEvent(event)
    }

    const onContextMenu = (event: MouseEvent) => {
      if (instance.interaction.busy.get()) return
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

      openFromEvent(event)
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

    const target = resolveContextTarget(instance, session.target)
    const menu = readContextMenuView({
      instance,
      target,
      close: dismissAction
    })
    if (!menu) {
      return undefined
    }

    return {
      placement: readPlacement({
        screen: session.screen,
        containerWidth: surface.width,
        containerHeight: surface.height
      }),
      summary: menu.summary,
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

  const menuStyle = {
    left: view.placement.left,
    top: view.placement.top,
    transform: view.placement.transform
  }
  const renderState: ContextMenuRenderState = {
    submenuKey,
    submenuSide: view.placement.submenuSide,
    openSubmenu: (key) => {
      setSubmenuKey(key)
    },
    clearSubmenu: () => {
      setSubmenuKey(null)
    }
  }

  return (
    <div className="wb-context-menu-layer" ref={rootRef} data-context-menu-ignore>
      <div
        className="wb-context-menu"
        style={menuStyle}
        {...MenuIgnoreAttrs}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onPointerLeave={() => {
          renderState.clearSubmenu()
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
        {view.groups.map((group) => (
          <ContextMenuGroupView
            key={group.key}
            group={group}
            state={renderState}
          />
        ))}
      </div>
    </div>
  )
}
