import type { EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'
import type { ContextMenuState } from './domain'
import { resolveContextMenuPlacement } from './placement'
import { resolveContextMenuSections } from './sections'
import type {
  ContextMenuOpenPayload,
  ContextMenuResolvedTarget,
  ContextMenuTarget,
  ContextMenuView
} from './types'

export type ContextMenuOpenResult = {
  payload: ContextMenuOpenPayload
  leaveScope: boolean
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

export const resolveContextMenuTarget = (
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

export const readContextMenuView = ({
  instance,
  state,
  containerWidth,
  containerHeight
}: {
  instance: InternalWhiteboardInstance
  state: ContextMenuState
  containerWidth: number
  containerHeight: number
}): ContextMenuView | undefined => {
  if (!state.open) return undefined

  const target = resolveContextMenuTarget(instance, state.target)
  if (!target) return undefined

  return {
    placement: resolveContextMenuPlacement({
      screen: state.screen,
      containerWidth,
      containerHeight
    }),
    sections: resolveContextMenuSections(target)
  }
}
