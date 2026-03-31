import { moveEdge } from '@whiteboard/core/edge'
import {
  buildMoveSet,
  resolveMoveEffect,
  type MoveSet
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../runtime/interaction'
import type { FeatureRuntime } from '../../runtime/editor/createEditor'

type ActiveDrag = {
  ids: readonly NodeId[]
  move: MoveSet
  startWorld: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  allowCross: boolean
  selectedEdgeIds: readonly EdgeId[]
  relatedEdgeIds: readonly EdgeId[]
}

export type NodeDragStart = {
  pointerId: number
  startWorld: Point
  startClient: Point
  frame: Rect
  anchorId: NodeId
  nodeIds: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  allowCross: boolean
  onStart?: () => void
}

export type NodeDragInteraction = {
  interaction: InteractionRegistration<ActiveDrag, NodeDragStart>
  createState: (input: NodeDragStart) => ActiveDrag | null
  clear: () => void
}

type NodeDragInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

export const createNodeDragInteraction = (
  ctx: NodeDragInteractionDeps
): NodeDragInteraction => {
  const clear = () => {
    ctx.output.node.set((current) => (
      current.patches.length === 0 && current.hovered === undefined
        ? current
        : {
            ...current,
            patches: [],
            hovered: undefined
          }
    ))
    ctx.output.snap.node.clear()
    ctx.output.edge.clear()
  }

  const readCanvasNodes = () => ctx.query.read.index.node.all().map((entry) => entry.node)

  const commit = (state: ActiveDrag) => {
    if (state.last.x !== 0 || state.last.y !== 0) {
      ctx.command.node.move({
        ids: state.ids,
        delta: state.last
      })
    }

    const edgeUpdates = state.selectedEdgeIds.flatMap((edgeId) => {
      const edge = ctx.query.read.edge.item.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, state.last)
      if (!patch) {
        return []
      }

      return [{
        id: edgeId,
        patch
      }]
    })

    if (edgeUpdates.length) {
      ctx.command.edge.updateMany(edgeUpdates)
    }
  }

  const updatePreview = (
    state: ActiveDrag,
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const world = ctx.viewport.pointer(input).world
    const rawPosition = {
      x: state.origin.x + (world.x - state.startWorld.x),
      y: state.origin.y + (world.y - state.startWorld.y)
    }
    const snapped = ctx.output.snap.node.move({
      rect: {
        x: rawPosition.x,
        y: rawPosition.y,
        width: state.size.width,
        height: state.size.height
      },
      excludeIds: state.move.members.map((member) => member.id),
      allowCross: state.allowCross,
      disabled: !ctx.query.read.tool.is('select')
    })
    const delta = {
      x: snapped.x - state.origin.x,
      y: snapped.y - state.origin.y
    }
    const preview = resolveMoveEffect({
      nodes: readCanvasNodes(),
      edges: state.relatedEdgeIds
        .map((edgeId) => ctx.query.read.edge.item.get(edgeId)?.edge)
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
      move: state.move,
      delta,
      nodeSize: ctx.query.config.nodeSize
    })
    state.last = delta
    const selectedEdgeUpdates = state.selectedEdgeIds.flatMap((edgeId) => {
      const edge = ctx.query.read.edge.item.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, delta)
      if (!patch) {
      return []
      }

      return [{
        id: edgeId,
        patch
      }]
    })

    ctx.output.node.set((current) => ({
      ...current,
      patches: preview.nodes.map(({ id, position }) => ({
        id,
        patch: {
          position
        }
      })),
      hovered: preview.hoveredContainerId
    }))
    ctx.output.edge.set(
      [
        ...selectedEdgeUpdates,
        ...preview.edges.map(({ id, patch }) => ({
          id,
          patch: {
            route: patch.route
          }
        }))
      ]
    )
  }

  const createState = (
    input: NodeDragStart
  ) => {
    const ids = input.nodeIds.includes(input.anchorId)
      ? input.nodeIds
      : [input.anchorId]
    const move = buildMoveSet({
      nodes: readCanvasNodes(),
      ids,
      nodeSize: ctx.query.config.nodeSize
    })
    if (!move.members.length) {
      return null
    }

    return {
      ids,
      move,
      startWorld: input.startWorld,
      origin: {
        x: input.frame.x,
        y: input.frame.y
      },
      last: {
        x: 0,
        y: 0
      },
      size: {
        width: input.frame.width,
        height: input.frame.height
      },
      allowCross: input.allowCross,
      selectedEdgeIds: input.edgeIds ?? [],
      relatedEdgeIds: ctx.query.read.edge.related(
        move.members.map((member) => member.id)
      ).filter((edgeId) => !(input.edgeIds ?? []).includes(edgeId)),
    }
  }

  const interaction: InteractionRegistration<ActiveDrag, NodeDragStart> = {
    key: 'node.drag',
    mode: 'node-drag',
    pan: (state) => ({
      frame: (pointer) => {
        updatePreview(state, pointer)
      }
    }),
    start: ({ input, state, session }) => {
      input.onStart?.()
      clear()
      session.pan({
        clientX: input.startClient.x,
        clientY: input.startClient.y
      })
      updatePreview(state, {
        clientX: input.startClient.x,
        clientY: input.startClient.y
      })
    },
    move: ({ state, session }, input: InteractionPointerInput) => {
      state.allowCross = input.altKey
      session.pan({
        clientX: input.client.x,
        clientY: input.client.y
      })
      updatePreview(state, {
        clientX: input.client.x,
        clientY: input.client.y
      })
    },
    up: ({ state, session }) => {
      commit(state)
      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  return {
    interaction,
    createState,
    clear
  }
}
