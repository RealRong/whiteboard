import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { isPointInRect } from '@whiteboard/core/geometry'
import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import type { PointerPick } from '../../../runtime/pick'
import {
  useElementSize,
  useInternalInstance
} from '../../../runtime/hooks'
import {
  hasEdge,
  hasNode
} from '../../../runtime/frame'
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
import { closeAfter } from './closeAfter'
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

type ContextMenuTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextMenuSelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
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
  edgeIds: readonly EdgeId[]
): ContextMenuSelectionSnapshot => ({
  nodeIds,
  edgeIds
})

const restoreSelection = (
  instance: Pick<ReturnType<typeof useInternalInstance>, 'commands'>,
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

const readContextMenuOpenResult = ({
  instance,
  input
}: {
  instance: Pick<ReturnType<typeof useInternalInstance>, 'read' | 'state' | 'registry'>
  input: PointerPick
}): {
  target: ContextMenuTarget
  leaveFrame: boolean
} | undefined => {
  const frame = instance.state.frame.get()
  const selection = instance.read.selection.get()
  const world = input.point.world
  const pick = input.pick

  if (pick.kind === 'selection-box' && selection.items.count > 1) {
    return {
      target: {
        kind: 'nodes',
        nodeIds: selection.target.nodeIds,
        world
      },
      leaveFrame: false
    }
  }

  if (pick.kind === 'node') {
    if (pick.part === 'container' && pick.id === frame.id) {
      return {
        target: {
          kind: 'canvas',
          world
        },
        leaveFrame: false
      }
    }

    return {
      target: selection.target.nodeSet.has(pick.id) && selection.items.count > 1
        ? {
            kind: 'nodes',
            nodeIds: selection.target.nodeIds,
            world
          }
        : {
            kind: 'node',
            nodeId: pick.id,
            world
          },
      leaveFrame: !hasNode(frame, pick.id)
    }
  }

  if (pick.kind === 'edge') {
    const entry = instance.read.edge.item.get(pick.id)
    if (!entry) return undefined

    return {
      target: {
        kind: 'edge',
        edgeId: pick.id,
        world
      },
      leaveFrame: !hasEdge(frame, entry.edge)
    }
  }

  const activeRect = frame.id
    ? instance.read.index.node.get(frame.id)?.rect
    : undefined
  const insideActiveFrame = Boolean(
    activeRect && isPointInRect(world, activeRect)
  )

  if (!insideActiveFrame) {
    const containerNodeId = instance.read.node.containerAt(world)
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
        leaveFrame: !hasNode(frame, containerNodeId)
      }
    }
  }

  return {
    target: {
      kind: 'canvas',
      world
    },
    leaveFrame: Boolean(frame.id)
  }
}

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
    target: ContextMenuTarget
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
      const result = readContextMenuOpenResult({
        instance,
        input
      })
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
      if (instance.interaction.mode.get() !== 'idle') return
      if (isContextMenuIgnoredTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()
      openFromEvent(event)
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

    const target = resolveContextMenuTarget(instance, session.target)
    if (!target) return undefined

    const readMenu = (): ContextMenuView => {
      switch (target.kind) {
        case 'canvas': {
          const frame = instance.state.frame.get()
          return {
            groups: [
              {
                key: 'edit',
                title: 'Edit',
                items: [
                  {
                    key: 'edit.paste',
                    label: 'Paste',
                    onClick: () => paste(instance, {
                      at: target.world,
                      containerId: frame.id
                    })
                  }
                ]
              },
              {
                key: 'create',
                title: 'Create',
                items: CREATE_PRESETS.map((preset) => ({
                  key: preset.key,
                  label: preset.label,
                    onClick: () => {
                      closeAfter(
                      insertPreset({
                        instance,
                        preset,
                        world: target.world,
                        containerId: frame.id
                      }),
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
                      instance.commands.selection.selectAll()
                      dismissAction()
                    }
                  }
                ]
              }
            ]
          }
        }
        case 'node': {
          const actions = createNodeSelectionActions(instance, [target.node], {
            onCopy: () => copy(instance, {
              nodeIds: [target.node.id]
            }),
            onCut: () => cut(instance, {
              nodeIds: [target.node.id]
            })
          })
          const groups = readNodeContextMenuGroups(actions, dismissAction)
          const styleGroup = buildStrokeStyleGroup({
            instance,
            nodes: [target.node]
          })
          if (styleGroup) {
            groups.unshift(bindNodeMenuGroup(styleGroup, dismissAction))
          }
          return {
            filter: readNodeMenuFilter(actions, dismissAction),
            groups
          }
        }
        case 'nodes': {
          const actions = createNodeSelectionActions(instance, target.nodes, {
            onCopy: () => copy(instance, {
              nodeIds: target.nodes.map((node) => node.id)
            }),
            onCut: () => cut(instance, {
              nodeIds: target.nodes.map((node) => node.id)
            })
          })
          const groups = readNodeContextMenuGroups(actions, dismissAction)
          const styleGroup = buildStrokeStyleGroup({
            instance,
            nodes: target.nodes
          })
          if (styleGroup) {
            groups.unshift(bindNodeMenuGroup(styleGroup, dismissAction))
          }
          return {
            summary: actions.summary,
            filter: readNodeMenuFilter(actions, dismissAction),
            groups
          }
        }
        case 'edge':
          return {
            groups: [
              bindNodeMenuGroup({
                key: 'edge.actions',
                items: [
                  {
                    key: 'edge.copy',
                    label: 'Copy',
                    onClick: () => copy(instance, {
                      edgeIds: [target.edgeId]
                    })
                  },
                  {
                    key: 'edge.cut',
                    label: 'Cut',
                    onClick: () => cut(instance, {
                      edgeIds: [target.edgeId]
                    })
                  },
                  {
                    key: 'edge.delete',
                    label: 'Delete',
                    tone: 'danger',
                    onClick: () => instance.commands.edge.delete([target.edgeId])
                  }
                ]
              }, dismissAction)
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

  const submenuSide: ContextMenuSide = view.placement.submenuSide
  const menuStyle = {
    left: view.placement.left,
    top: view.placement.top,
    transform: view.placement.transform
  }

  const renderLeafItem = (item: NodeMenuItem) => (
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

  const renderSubmenuItem = (item: NodeMenuItem) => {
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

  const renderGroup = (group: NodeMenuGroup) => (
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
