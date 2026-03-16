import type { EdgeId, Node, NodeId, Point } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'
import {
  hasContainerEdge,
  hasContainerNode
} from '../../runtime/state'
import { buildCanvasSections } from './sections/canvas'
import { buildEdgeSections } from './sections/edge'
import { buildNodeSections, buildNodesSections } from './sections/node'
import type {
  ContextMenuModel,
  ContextMenuOpenPayload,
  ContextMenuSession,
  ContextMenuTarget
} from './types'

export type ContextMenuOpenResult = {
  payload: ContextMenuOpenPayload
  leaveContainer: boolean
}

type ContextMenuResolvedTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: Node; world: Point }
  | { kind: 'nodes'; nodes: readonly Node[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextMenuTargetInstance = Pick<WhiteboardInstance, 'read'>
type ContextMenuSectionInstance = Pick<WhiteboardInstance, 'state'>
type ContextMenuOpenInstance = Pick<WhiteboardInstance, 'read' | 'state'>

const MENU_WIDTH = 220
const MENU_SAFE_MARGIN = 12

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
