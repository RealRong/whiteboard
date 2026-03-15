import { useMemo } from 'react'
import type { EdgeId, Node, NodeId, Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../runtime/instance'
import { useInternalInstance } from '../../runtime/hooks'
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
  leaveScope: boolean
}

type ContextMenuResolvedTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: Node; world: Point }
  | { kind: 'nodes'; nodes: readonly Node[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

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
  instance: InternalWhiteboardInstance,
  target: ContextMenuTarget
): ContextMenuResolvedTarget | undefined => {
  switch (target.kind) {
    case 'canvas':
      return target
    case 'node': {
      const entry = instance.read.node.get(target.nodeId)
      if (!entry) return undefined
      return {
        kind: 'node',
        node: entry.node,
        world: target.world
      }
    }
    case 'nodes': {
      const nodes = target.nodeIds
        .map((nodeId) => instance.read.node.get(nodeId)?.node)
        .filter((node): node is NonNullable<typeof node> => Boolean(node))

      if (!nodes.length) return undefined

      return {
        kind: 'nodes',
        nodes,
        world: target.world
      }
    }
    case 'edge': {
      const entry = instance.read.edge.get(target.edgeId)
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
  instance: InternalWhiteboardInstance,
  target: ContextMenuResolvedTarget
) => {
  switch (target.kind) {
    case 'canvas': {
      const scope = instance.view.scope.get()
      return buildCanvasSections({
        world: target.world,
        activeContainerId: scope.activeId,
        scopeNodeIds: scope.activeId
          ? scope.nodeIds
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
  instance: InternalWhiteboardInstance
  targetElement: Element | null
  screen: Point
  world: Point
}): ContextMenuOpenResult | undefined => {
  const scope = instance.view.scope.get()
  const selection = instance.view.selection.get()
  const nodeId = readElementNodeId(targetElement)

  if (nodeId) {
    return {
      payload: {
        screen,
        target: selection.nodeIdSet.has(nodeId) && selection.nodeCount > 1
          ? {
              kind: 'nodes',
              nodeIds: selection.nodeIds,
              world
            }
          : {
              kind: 'node',
              nodeId,
              world
            }
      },
      leaveScope: !scope.hasNode(nodeId)
    }
  }

  const edgeId = readElementEdgeId(targetElement)
  if (edgeId) {
    const entry = instance.read.edge.get(edgeId)
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
      leaveScope: !scope.hasEdge(entry.edge)
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
    leaveScope: Boolean(scope.activeId)
  }
}

const readContextMenu = ({
  instance,
  session,
  containerWidth,
  containerHeight
}: {
  instance: InternalWhiteboardInstance
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

export const useContextMenu = ({
  session,
  containerWidth,
  containerHeight
}: {
  session: ContextMenuSession
  containerWidth: number
  containerHeight: number
}): ContextMenuModel | undefined => {
  const instance = useInternalInstance()

  return useMemo(
    () => readContextMenu({
      instance,
      session,
      containerWidth,
      containerHeight
    }),
    [containerHeight, containerWidth, instance, session]
  )
}
