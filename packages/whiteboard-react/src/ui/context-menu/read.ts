import type {
  DispatchResult,
  EdgeId,
  Node,
  NodeId,
  NodeInput,
  Operation,
  Point
} from '@whiteboard/core/types'
import type { BoardInstance } from '../../runtime/instance'
import {
  hasContainerEdge,
  hasContainerNode
} from '../../runtime/state'
import {
  summarizeNodes,
  type NodeSummary
} from '../../features/node/summary'
import {
  deleteNodes,
  duplicateNodes,
  groupNodes,
  selectNodeIds,
  setNodesLocked,
  ungroupNodes
} from '../../features/node/commands'
import type {
  ContextMenuItem,
  ContextMenuOpenPayload,
  ContextMenuSection,
  ContextMenuSession,
  ContextMenuTarget
} from './types'

export type ContextMenuOpenResult = {
  payload: ContextMenuOpenPayload
  leaveContainer: boolean
}

type ContextMenuModel = {
  placement: {
    left: number
    top: number
    transform?: string
  }
  sections: readonly ContextMenuSection[]
}

type ContextMenuResolvedTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: Node; world: Point }
  | { kind: 'nodes'; nodes: readonly Node[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextMenuTargetInstance = Pick<BoardInstance, 'read'>
type ContextMenuSectionInstance = Pick<BoardInstance, 'state'>
type ContextMenuOpenInstance = Pick<BoardInstance, 'read' | 'state'>

const MENU_WIDTH = 220
const MENU_SAFE_MARGIN = 12

type CreateNodePreset = {
  key: string
  label: string
  input: (world: Point) => NodeInput
}

const readElementNodeId = (
  targetElement: Element | null
): NodeId | undefined => (
  targetElement
    ?.closest('[data-node-id]')
    ?.getAttribute('data-node-id')
    ?? undefined
)

const readElementEdgeId = (
  targetElement: Element | null
): EdgeId | undefined => (
  targetElement
    ?.closest('[data-edge-id]')
    ?.getAttribute('data-edge-id')
    ?? undefined
)

const resolveContextMenuTarget = (
  instance: ContextMenuTargetInstance,
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

const centerNodeInput = (
  world: Point,
  input: Omit<NodeInput, 'position'>
): NodeInput => {
  const width = input.size?.width ?? 160
  const height = input.size?.height ?? 80

  return {
    ...input,
    position: {
      x: world.x - width / 2,
      y: world.y - height / 2
    }
  }
}

const createNodePresets: readonly CreateNodePreset[] = [
  {
    key: 'create.text',
    label: 'Add text',
    input: (world) => centerNodeInput(world, {
      type: 'text',
      size: { width: 180, height: 44 },
      data: { text: '' }
    })
  },
  {
    key: 'create.sticky',
    label: 'Add sticky',
    input: (world) => centerNodeInput(world, {
      type: 'sticky',
      size: { width: 180, height: 140 },
      data: { text: '' }
    })
  },
  {
    key: 'create.rect',
    label: 'Add rectangle',
    input: (world) => centerNodeInput(world, {
      type: 'rect',
      size: { width: 180, height: 100 },
      data: { title: 'Rectangle' }
    })
  },
  {
    key: 'create.ellipse',
    label: 'Add ellipse',
    input: (world) => centerNodeInput(world, {
      type: 'ellipse',
      size: { width: 180, height: 100 },
      data: { title: 'Ellipse' }
    })
  },
  {
    key: 'create.diamond',
    label: 'Add diamond',
    input: (world) => centerNodeInput(world, {
      type: 'diamond',
      size: { width: 180, height: 120 },
      data: { title: 'Decision' }
    })
  },
  {
    key: 'create.triangle',
    label: 'Add triangle',
    input: (world) => centerNodeInput(world, {
      type: 'triangle',
      size: { width: 180, height: 130 },
      data: { title: 'Triangle' }
    })
  },
  {
    key: 'create.callout',
    label: 'Add callout',
    input: (world) => centerNodeInput(world, {
      type: 'callout',
      size: { width: 220, height: 130 },
      data: { text: 'Callout' }
    })
  },
  {
    key: 'create.arrow-sticker',
    label: 'Add arrow sticker',
    input: (world) => centerNodeInput(world, {
      type: 'arrow-sticker',
      size: { width: 220, height: 110 },
      data: { title: 'Arrow' }
    })
  },
  {
    key: 'create.highlight',
    label: 'Add highlight',
    input: (world) => centerNodeInput(world, {
      type: 'highlight',
      size: { width: 220, height: 90 },
      data: { text: 'Highlight' }
    })
  }
]

const closeAfterDispatch = (
  effect: Promise<DispatchResult>,
  close: () => void,
  onSuccess?: (result: DispatchResult) => void
) => {
  void effect
    .then((result) => {
      if (!result.ok) return
      onSuccess?.(result)
    })
    .finally(close)
}

const readCreatedNodeIds = (
  result: DispatchResult
): NodeId[] => {
  if (!result.ok) return []

  return result.changes.operations
    .filter((operation): operation is Extract<Operation, { type: 'node.create' }> =>
      operation.type === 'node.create'
    )
    .map((operation) => operation.node.id)
}

const buildCanvasSections = ({
  world,
  activeContainerId,
  containerNodeIds
}: {
  world: Point
  activeContainerId?: NodeId
  containerNodeIds?: readonly NodeId[]
}): readonly ContextMenuSection[] => [
  {
    key: 'create',
    title: 'Create',
    items: createNodePresets.map((preset) => {
      const input = preset.input(world)
      return {
        key: preset.key,
        label: preset.label,
        run: ({ instance, close }) => {
          closeAfterDispatch(
            instance.commands.node.create(
              activeContainerId
                ? { ...input, parentId: activeContainerId }
                : input
            ),
            close,
            (result) => {
              selectNodeIds(instance, readCreatedNodeIds(result))
            }
          )
        }
      }
    })
  },
  {
    key: 'history',
    title: 'History',
    items: [
      {
        key: 'history.undo',
        label: 'Undo',
        run: ({ instance, close }) => {
          instance.commands.history.undo()
          close()
        }
      },
      {
        key: 'history.redo',
        label: 'Redo',
        run: ({ instance, close }) => {
          instance.commands.history.redo()
          close()
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
        run: ({ instance, close }) => {
          if (activeContainerId) {
            selectNodeIds(instance, containerNodeIds ?? [])
          } else {
            instance.commands.selection.selectAll()
          }
          close()
        }
      }
    ]
  }
]

const closeAfter = (
  effect: Promise<unknown>,
  close: () => void
) => {
  void effect.finally(close)
}

const buildDuplicateItem = ({
  key,
  nodeIds,
  disabled
}: {
  key: string
  nodeIds: readonly NodeId[]
  disabled: boolean
}): ContextMenuItem => ({
  key,
  label: 'Duplicate',
  disabled,
  run: ({ instance, close }) => {
    if (disabled) return
    closeAfter(duplicateNodes(instance, nodeIds), close)
  }
})

const buildDeleteItem = ({
  key,
  nodeIds,
  disabled
}: {
  key: string
  nodeIds: readonly NodeId[]
  disabled: boolean
}): ContextMenuItem => ({
  key,
  label: 'Delete',
  tone: 'danger',
  disabled,
  run: ({ instance, close }) => {
    if (disabled) return
    closeAfter(deleteNodes(instance, nodeIds), close)
  }
})

const buildLockItem = ({
  key,
  nodes,
  summary
}: {
  key: string
  nodes: readonly Node[]
  summary: NodeSummary
}): ContextMenuItem => ({
  key,
  label: summary.lock === 'all'
    ? (summary.count > 1 ? 'Unlock selected' : 'Unlock')
    : (summary.count > 1 ? 'Lock selected' : 'Lock'),
  disabled: summary.count === 0,
  run: ({ instance, close }) => {
    if (!nodes.length) {
      close()
      return
    }
    closeAfter(setNodesLocked(instance, nodes, summary.lock !== 'all'), close)
  }
})

const buildArrangeSection = (
  nodeIds: readonly NodeId[]
): ContextMenuSection => ({
  key: 'arrange',
  title: 'Arrange',
  items: [
    {
      key: 'arrange.front',
      label: 'Bring to front',
      run: ({ instance, close }) => {
        void instance.commands.node.order.bringToFront([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    },
    {
      key: 'arrange.forward',
      label: 'Bring forward',
      run: ({ instance, close }) => {
        void instance.commands.node.order.bringForward([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    },
    {
      key: 'arrange.backward',
      label: 'Send backward',
      run: ({ instance, close }) => {
        void instance.commands.node.order.sendBackward([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    },
    {
      key: 'arrange.back',
      label: 'Send to back',
      run: ({ instance, close }) => {
        void instance.commands.node.order.sendToBack([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    }
  ]
})

const buildGroupSection = (
  node: Node
): ContextMenuSection => {
  const collapsed = Boolean(node.data?.collapsed)
  const autoFit = node.data?.autoFit === 'manual' ? 'manual' : 'expand-only'

  return {
    key: 'group',
    title: 'Group',
    items: [
      {
        key: 'group.toggle-collapse',
        label: collapsed ? 'Expand' : 'Collapse',
        run: ({ instance, close }) => {
          void instance.commands.node.updateData(node.id, {
            collapsed: !collapsed
          })
            .then((result) => {
              if (!result.ok) return
              selectNodeIds(instance, [node.id])
            })
            .finally(close)
        }
      },
      {
        key: 'group.auto-fit-expand-only',
        label: autoFit === 'expand-only'
          ? 'Auto fit: expand-only'
          : 'Set auto fit: expand-only',
        run: ({ instance, close }) => {
          void instance.commands.node.updateData(node.id, {
            autoFit: 'expand-only'
          })
            .then((result) => {
              if (!result.ok) return
              selectNodeIds(instance, [node.id])
            })
            .finally(close)
        }
      },
      {
        key: 'group.auto-fit-manual',
        label: autoFit === 'manual'
          ? 'Auto fit: manual'
          : 'Set auto fit: manual',
        run: ({ instance, close }) => {
          void instance.commands.node.updateData(node.id, {
            autoFit: 'manual'
          })
            .then((result) => {
              if (!result.ok) return
              selectNodeIds(instance, [node.id])
            })
            .finally(close)
        }
      }
    ]
  }
}

const buildNodeSections = (
  node: Node
): readonly ContextMenuSection[] => {
  const nodes = [node]
  const summary = summarizeNodes(nodes)
  const nodeIds = summary.ids
  const sections: ContextMenuSection[] = [
    {
      key: 'node.actions',
      items: [
        buildDuplicateItem({
          key: 'node.duplicate',
          nodeIds,
          disabled: summary.count === 0
        }),
        buildDeleteItem({
          key: 'node.delete',
          nodeIds,
          disabled: summary.count === 0
        }),
        buildLockItem({
          key: 'node.lock',
          nodes,
          summary
        })
      ]
    },
    buildArrangeSection(nodeIds)
  ]

  if (node.type === 'group') {
    sections.push(buildGroupSection(node))
  }

  return sections
}

const buildNodesSections = (
  nodes: readonly Node[]
): readonly ContextMenuSection[] => {
  const summary = summarizeNodes(nodes)
  const nodeIds = summary.ids

  return [
    {
      key: 'nodes.actions',
      items: [
        buildDuplicateItem({
          key: 'nodes.duplicate',
          nodeIds,
          disabled: summary.count === 0
        }),
        buildDeleteItem({
          key: 'nodes.delete',
          nodeIds,
          disabled: summary.count === 0
        }),
        buildLockItem({
          key: 'nodes.lock',
          nodes,
          summary
        }),
        {
          key: 'nodes.group',
          label: 'Group',
          disabled: summary.count < 2,
          run: ({ instance, close }) => {
            if (summary.count < 2) return
            closeAfter(groupNodes(instance, nodeIds), close)
          }
        },
        {
          key: 'nodes.ungroup',
          label: 'Ungroup',
          disabled: !summary.hasGroup,
          run: ({ instance, close }) => {
            if (!summary.hasGroup) return
            closeAfter(ungroupNodes(instance, nodeIds), close)
          }
        }
      ]
    },
    buildArrangeSection(nodeIds)
  ]
}

const buildEdgeSections = (
  edgeId: EdgeId
): readonly ContextMenuSection[] => [
  {
    key: 'edge.actions',
    items: [
      {
        key: 'edge.delete',
        label: 'Delete',
        tone: 'danger',
        run: ({ instance, close }) => {
          void instance.commands.edge.delete([edgeId])
            .then((result) => {
              if (!result.ok) return
              instance.commands.selection.selectEdge(undefined)
            })
            .finally(close)
        }
      }
    ]
  }
]

const readSections = (
  instance: ContextMenuSectionInstance,
  target: ContextMenuResolvedTarget
) => {
  switch (target.kind) {
    case 'canvas': {
      const container = instance.state.container.get()
      return buildCanvasSections({
        world: target.world,
        activeContainerId: container.id,
        containerNodeIds: container.id
          ? container.ids
          : undefined
      })
    }
    case 'node':
      return buildNodeSections(target.node)
    case 'nodes':
      return buildNodesSections(target.nodes)
    case 'edge':
      return buildEdgeSections(target.edgeId)
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
    Math.max(MENU_SAFE_MARGIN, screen.x),
    Math.max(MENU_SAFE_MARGIN, containerWidth - MENU_SAFE_MARGIN)
  )
  const top = Math.min(
    Math.max(MENU_SAFE_MARGIN, screen.y),
    Math.max(MENU_SAFE_MARGIN, containerHeight - MENU_SAFE_MARGIN)
  )

  const alignRight = left + MENU_WIDTH > containerWidth - MENU_SAFE_MARGIN
  const alignBottom = top + 280 > containerHeight - MENU_SAFE_MARGIN

  return {
    left,
    top,
    transform: `${alignRight ? 'translateX(-100%)' : ''} ${alignBottom ? 'translateY(-100%)' : ''}`.trim()
  }
}

export const readContextMenuOpenResult = ({
  instance,
  targetElement,
  screen,
  world
}: {
  instance: ContextMenuOpenInstance
  targetElement: Element | null
  screen: Point
  world: Point
}): ContextMenuOpenResult | undefined => {
  const container = instance.state.container.get()
  const selection = instance.state.selection.get()
  const nodeId = readElementNodeId(targetElement)

  if (nodeId) {
    return {
      payload: {
        screen,
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
            }
      },
      leaveContainer: !hasContainerNode(container, nodeId)
    }
  }

  const edgeId = readElementEdgeId(targetElement)
  if (edgeId) {
    const entry = instance.read.edge.item.get(edgeId)
    if (!entry) return undefined

    return {
      payload: {
        screen,
        target: {
          kind: 'edge',
          edgeId,
          world
        }
      },
      leaveContainer: !hasContainerEdge(container, entry.edge)
    }
  }

  return {
    payload: {
      screen,
      target: {
        kind: 'canvas',
        world
      }
    },
    leaveContainer: Boolean(container.id)
  }
}

export const readContextMenu = ({
  instance,
  session,
  containerWidth,
  containerHeight
}: {
  instance: ContextMenuOpenInstance
  session: ContextMenuSession
  containerWidth: number
  containerHeight: number
}): ContextMenuModel | undefined => {
  if (!session) return undefined

  const target = resolveContextMenuTarget(instance, session.target)
  if (!target) return undefined

  return {
    placement: readPlacement({
      screen: session.screen,
      containerWidth,
      containerHeight
    }),
    sections: readSections(instance, target)
  }
}
