import {
  buildMoveCommit,
  buildMoveSet,
  type MoveSet,
  projectMovePreview
} from '@whiteboard/core/node'
import type { Edge, EdgeId, Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { InteractionSession } from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import type { SelectionInteractionCtx, SessionPointer } from './context'
import { readViewport } from './context'

type NodeDragState = {
  ids: readonly NodeId[]
  nodes: readonly Node[]
  moveSet: MoveSet
  startWorld: Point
  origin: Point
  delta: Point
  frameSize: {
    width: number
    height: number
  }
  allowCross: boolean
  selectedEdges: readonly Edge[]
  relatedEdges: readonly Edge[]
}

type NodeDragStart = {
  startWorld: Point
  frame: Rect
  anchorId: NodeId
  nodeIds: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  allowCross: boolean
}

type NodeDragInput = {
  start: PointerDownInput
  input: SessionPointer
  frame: Rect
  anchorId: NodeId
  target: import('@whiteboard/core/selection').SelectionTarget
  nextSelection?: import('@whiteboard/core/selection').SelectionTarget
}

const clearNodeDrag = (
  ctx: SelectionInteractionCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.node.selection.patches.length === 0
      && current.node.selection.hovered === undefined
      && current.edge.selection.length === 0
      && current.guides.snap.length === 0
    )
      ? current
      : {
          ...current,
          node: {
            ...current.node,
            selection: {
              patches: [],
              hovered: undefined
            }
          },
          edge: {
            ...current.edge,
            selection: []
          },
          guides: {
            ...current.guides,
            snap: []
          }
        }
  ))
}

const gatherNodeDragState = (
  ctx: SelectionInteractionCtx,
  input: NodeDragStart
): NodeDragState | null => {
  const nodes = ctx.read.index.node.all().map((entry) => entry.node)
  const ids = input.nodeIds.includes(input.anchorId)
    ? input.nodeIds
    : [input.anchorId]
  const moveSet = buildMoveSet({
    nodes,
    ids,
    nodeSize: ctx.config.nodeSize
  })
  if (!moveSet.members.length) {
    return null
  }

  return {
    ids,
    nodes,
    moveSet,
    startWorld: input.startWorld,
    origin: {
      x: input.frame.x,
      y: input.frame.y
    },
    delta: {
      x: 0,
      y: 0
    },
    frameSize: {
      width: input.frame.width,
      height: input.frame.height
    },
    allowCross: input.allowCross,
    selectedEdges: (input.edgeIds ?? []).flatMap((edgeId) => {
      const edge = ctx.read.edge.item.get(edgeId)?.edge
      return edge ? [edge] : []
    }),
    relatedEdges: ctx.read.edge.related(
      moveSet.members.map((member) => member.id)
    ).filter((edgeId) => !(input.edgeIds ?? []).includes(edgeId)).flatMap((edgeId) => {
      const edge = ctx.read.edge.item.get(edgeId)?.edge
      return edge ? [edge] : []
    })
  }
}

const computeNodeDragProjection = (
  ctx: SelectionInteractionCtx,
  state: NodeDragState,
  input: {
    clientX: number
    clientY: number
  }
) => {
  const world = readViewport(ctx).pointer(input).world
  const rawPosition = {
    x: state.origin.x + (world.x - state.startWorld.x),
    y: state.origin.y + (world.y - state.startWorld.y)
  }
  const snapped = ctx.snap.node.move({
    rect: {
      x: rawPosition.x,
      y: rawPosition.y,
      width: state.frameSize.width,
      height: state.frameSize.height
    },
    excludeIds: state.moveSet.members.map((member) => member.id),
    allowCross: state.allowCross,
    disabled: !ctx.read.tool.is('select')
  })
  const delta = {
    x: snapped.rect.x - state.origin.x,
    y: snapped.rect.y - state.origin.y
  }
  const preview = projectMovePreview({
    nodes: state.nodes as readonly Node[],
    relatedEdges: state.relatedEdges as readonly Edge[],
    selectedEdges: state.selectedEdges as readonly Edge[],
    move: state.moveSet,
    delta,
    nodeSize: ctx.config.nodeSize
  })

  return {
    delta,
    preview,
    guides: snapped.guides
  }
}

const applyNodeDragProjection = (
  ctx: SelectionInteractionCtx,
  state: NodeDragState,
  projection: ReturnType<typeof computeNodeDragProjection>
) => {
  state.delta = projection.delta
  ctx.overlay.set((current) => ({
    ...current,
    node: {
      ...current.node,
      selection: {
        patches: projection.preview.nodes.map(({ id, position }) => ({
          id,
          patch: {
            position
          }
        })),
        hovered: projection.preview.hovered
      }
    },
    edge: {
      ...current.edge,
      selection: projection.preview.edges.map(({ id, patch }) => ({
        id,
        patch: {
          route: patch.route,
          source: patch.source,
          target: patch.target
        }
      }))
    },
    guides: {
      ...current.guides,
      snap: projection.guides
    }
  }))
}

const projectNodeDragPreview = (
  ctx: SelectionInteractionCtx,
  state: NodeDragState,
  input: {
    clientX: number
    clientY: number
  }
) => {
  applyNodeDragProjection(
    ctx,
    state,
    computeNodeDragProjection(ctx, state, input)
  )
}

const commitNodeDrag = (
  ctx: SelectionInteractionCtx,
  state: NodeDragState
) => {
  const result = buildMoveCommit({
    delta: state.delta,
    selectedEdges: state.selectedEdges
  })

  if (result.delta) {
    ctx.commands.node.move({
      ids: state.ids,
      delta: result.delta
    })
  }

  if (result.edges.length) {
    ctx.commands.edge.updateMany(result.edges)
  }
}

export const createDragInteraction = (
  ctx: SelectionInteractionCtx,
  input: NodeDragInput
): InteractionSession | null => {
  const state = gatherNodeDragState(ctx, {
    startWorld: input.start.world,
    frame: input.frame,
    anchorId: input.anchorId,
    nodeIds: input.target.nodeIds,
    edgeIds: input.target.edgeIds,
    allowCross: input.input.modifiers.alt
  })
  if (!state) {
    return null
  }

  if (input.nextSelection) {
    ctx.commands.selection.replace(input.nextSelection)
  }

  clearNodeDrag(ctx)
  projectNodeDragPreview(ctx, state, {
    clientX: input.input.client.x,
    clientY: input.input.client.y
  })

  return {
    mode: 'node-drag',
    pointerId: input.start.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        projectNodeDragPreview(ctx, state, pointer)
      }
    },
    move: (next) => {
      state.allowCross = next.modifiers.alt
      projectNodeDragPreview(ctx, state, {
        clientX: next.client.x,
        clientY: next.client.y
      })
    },
    up: () => {
      commitNodeDrag(ctx, state)
    },
    cleanup: () => {
      clearNodeDrag(ctx)
    }
  }
}
