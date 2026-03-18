import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
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
  arrangeNodes,
  deleteNodes,
  duplicateNodes,
  groupNodes,
  toggleNodesLock,
  type GroupAutoFitMode,
  ungroupNodes,
  updateGroupNode
} from '../features/node/commands'
import {
  readLockLabel,
  summarizeNodes
} from '../features/node/summary'
import {
  CREATE_NODE_PRESETS,
  closeAfter,
  createNodeFromPreset,
  selectAllInScope
} from './actions'
import {
  isContextMenuIgnoredTarget,
  readElementEdgeId,
  readElementNodeId
} from './CanvasTargeting'

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
  onClick: () => void
}

type ContextMenuSection = {
  key: string
  title?: string
  items: readonly ContextMenuItem[]
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
    transform: `${alignRight ? 'translateX(-100%)' : ''} ${alignBottom ? 'translateY(-100%)' : ''}`.trim()
  }
}

const readContextMenuOpenResult = ({
  instance,
  targetElement,
  screen,
  world
}: {
  instance: Pick<ReturnType<typeof useInternalInstance>, 'read' | 'state'>
  targetElement: Element | null
  screen: Point
  world: Point
}): {
  target: ContextMenuTarget
  leaveContainer: boolean
} | undefined => {
  const container = instance.state.container.get()
  const selection = instance.state.selection.get()
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

  const dismiss = useCallback((mode: 'dismiss' | 'action') => {
    setSession((current) => {
      if (mode === 'dismiss' && current) {
        restoreSelection(instance, current.selection)
      }
      return null
    })
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

    const selection = instance.state.selection.get()
    setSession({
      screen: result.screen,
      target: result.target,
      selection: snapshotSelection(
        selection.target.nodeIds,
        selection.target.edgeId
      )
    })
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

    const buildArrangeSection = (
      nodeIds: readonly NodeId[]
    ): ContextMenuSection => ({
      key: 'arrange',
      title: 'Arrange',
      items: [
        {
          key: 'arrange.front',
          label: 'Bring to front',
          onClick: () => {
            closeAfter(arrangeNodes(instance, nodeIds, 'front'), dismissAction)
          }
        },
        {
          key: 'arrange.forward',
          label: 'Bring forward',
          onClick: () => {
            closeAfter(arrangeNodes(instance, nodeIds, 'forward'), dismissAction)
          }
        },
        {
          key: 'arrange.backward',
          label: 'Send backward',
          onClick: () => {
            closeAfter(arrangeNodes(instance, nodeIds, 'backward'), dismissAction)
          }
        },
        {
          key: 'arrange.back',
          label: 'Send to back',
          onClick: () => {
            closeAfter(arrangeNodes(instance, nodeIds, 'back'), dismissAction)
          }
        }
      ]
    })

    const buildNodeActionItems = (
      nodes: readonly WhiteboardNode[]
    ): ContextMenuSection => {
      const summary = summarizeNodes(nodes)
      const nodeIds = summary.ids

      return {
        key: `${nodes.length > 1 ? 'nodes' : 'node'}.actions`,
        items: [
          {
            key: `${nodes.length > 1 ? 'nodes' : 'node'}.duplicate`,
            label: 'Duplicate',
            disabled: summary.count === 0,
            onClick: () => {
              if (summary.count === 0) return
              closeAfter(duplicateNodes(instance, nodeIds), dismissAction)
            }
          },
          {
            key: `${nodes.length > 1 ? 'nodes' : 'node'}.delete`,
            label: 'Delete',
            tone: 'danger',
            disabled: summary.count === 0,
            onClick: () => {
              if (summary.count === 0) return
              closeAfter(deleteNodes(instance, nodeIds), dismissAction)
            }
          },
          {
            key: `${nodes.length > 1 ? 'nodes' : 'node'}.lock`,
            label: readLockLabel(summary),
            disabled: summary.count === 0,
            onClick: () => {
              if (summary.count === 0) return
              closeAfter(toggleNodesLock(instance, nodes, summary), dismissAction)
            }
          }
        ]
      }
    }

    const buildGroupSection = (
      node: WhiteboardNode
    ): ContextMenuSection => {
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

    const readSections = (): readonly ContextMenuSection[] => {
      switch (target.kind) {
        case 'canvas': {
          const container = instance.state.container.get()
          return [
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
        case 'node': {
          const summary = summarizeNodes([target.node])
          const sections: ContextMenuSection[] = [
            buildNodeActionItems([target.node]),
            buildArrangeSection(summary.ids)
          ]
          if (target.node.type === 'group') {
            sections.push(buildGroupSection(target.node))
          }
          return sections
        }
        case 'nodes': {
          const summary = summarizeNodes(target.nodes)
          return [
            {
              ...buildNodeActionItems(target.nodes),
              items: [
                ...buildNodeActionItems(target.nodes).items,
                {
                  key: 'nodes.group',
                  label: 'Group',
                  disabled: summary.count < 2,
                  onClick: () => {
                    if (summary.count < 2) return
                    closeAfter(groupNodes(instance, summary.ids), dismissAction)
                  }
                },
                {
                  key: 'nodes.ungroup',
                  label: 'Ungroup',
                  disabled: !summary.hasGroup,
                  onClick: () => {
                    if (!summary.hasGroup) return
                    closeAfter(ungroupNodes(instance, summary.ids), dismissAction)
                  }
                }
              ]
            },
            buildArrangeSection(summary.ids)
          ]
        }
        case 'edge':
          return [
            {
              key: 'edge.actions',
              items: [
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

    return {
      placement: readPlacement({
        screen: session.screen,
        containerWidth: surface.width,
        containerHeight: surface.height
      }),
      sections: readSections()
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

  return (
    <div className="wb-context-menu-layer" ref={rootRef} data-context-menu-ignore>
      <div
        className="wb-context-menu"
        style={view.placement}
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
      >
        {view.sections.map((section) => (
          <div key={section.key} className="wb-context-menu-section">
            {section.title ? (
              <div className="wb-context-menu-section-title">{section.title}</div>
            ) : null}
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className="wb-context-menu-item"
                data-tone={item.tone === 'danger' ? 'danger' : undefined}
                disabled={item.disabled}
                data-context-menu-item={item.key}
                onClick={item.onClick}
                data-context-menu-ignore
                data-selection-ignore
                data-input-ignore
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
