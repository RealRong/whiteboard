import {
  buildMoveCommit,
  buildMoveSet,
  projectMovePreview,
  type MoveSet
} from '@whiteboard/core/node'
import type { SelectionTarget } from '@whiteboard/core/selection'
import type {
  Edge,
  EdgeId,
  Node,
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type { PointerDown } from '../../runtime/input/pointer'
import type {
  ActiveInteraction,
  InteractionPointerInput
} from '../../runtime/interaction'
import type { InteractionHost } from '../../runtime/interaction/host'

type ActiveDrag = {
  ids: readonly NodeId[]
  nodes: readonly Node[]
  move: MoveSet
  startWorld: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  allowCross: boolean
  selectedEdges: readonly Edge[]
  relatedEdges: readonly Edge[]
}

type NodeDragStart = {
  pointerId: number
  startWorld: Point
  frame: Rect
  anchorId: NodeId
  nodeIds: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  allowCross: boolean
}

export type NodeDragPhaseInput = {
  start: PointerDown
  input: InteractionPointerInput
  frame: Rect
  anchorId: NodeId
  target: SelectionTarget
  nextSelection?: SelectionTarget
}

type NodeDragRuntimeDeps = Pick<
  InteractionHost,
  'read' | 'config' | 'commands' | 'viewport' | 'overlay' | 'snap'
>

const clearNodeDrag = (
  ctx: NodeDragRuntimeDeps
): void => {
  ctx.overlay.set((current) => (
    (
      current.node.patches.length === 0
      && current.node.hovered === undefined
      && current.edge.patches.length === 0
      && current.guides.snap.length === 0
    )
      ? current
      : {
          ...current,
          node: {
            ...current.node,
            patches: [],
            hovered: undefined
          },
          edge: {
            patches: []
          },
          guides: {
            ...current.guides,
            snap: []
          }
        }
  ))
}

const commitNodeDrag = (
  ctx: NodeDragRuntimeDeps,
  state: ActiveDrag
) => {
  const result = buildMoveCommit({
    delta: state.last,
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

const updateNodeDragPreview = (
  ctx: NodeDragRuntimeDeps,
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
  const snapped = ctx.snap.node.move({
    rect: {
      x: rawPosition.x,
      y: rawPosition.y,
      width: state.size.width,
      height: state.size.height
    },
    excludeIds: state.move.members.map((member) => member.id),
    allowCross: state.allowCross,
    disabled: !ctx.read.tool.is('select')
  })
  const delta = {
    x: snapped.rect.x - state.origin.x,
    y: snapped.rect.y - state.origin.y
  }
  const preview = projectMovePreview({
    nodes: state.nodes,
    relatedEdges: state.relatedEdges,
    selectedEdges: state.selectedEdges,
    move: state.move,
    delta,
    nodeSize: ctx.config.nodeSize
  })
  state.last = delta

  ctx.overlay.set((current) => ({
    ...current,
    node: {
      ...current.node,
      patches: preview.nodes.map(({ id, position }) => ({
        id,
        patch: {
          position
        }
      })),
      hovered: preview.hovered
    },
    edge: {
      patches: preview.edges.map(({ id, patch }) => ({
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
      snap: snapped.guides
    }
  }))
}

const createNodeDragState = (
  ctx: NodeDragRuntimeDeps,
  input: NodeDragStart
): ActiveDrag | null => {
  const nodes = ctx.read.index.node.all().map((entry) => entry.node)
  const ids = input.nodeIds.includes(input.anchorId)
    ? input.nodeIds
    : [input.anchorId]
  const move = buildMoveSet({
    nodes,
    ids,
    nodeSize: ctx.config.nodeSize
  })
  if (!move.members.length) {
    return null
  }

  return {
    ids,
    nodes,
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
    selectedEdges: (input.edgeIds ?? []).flatMap((edgeId) => {
      const edge = ctx.read.edge.item.get(edgeId)?.edge
      return edge ? [edge] : []
    }),
    relatedEdges: ctx.read.edge.related(
      move.members.map((member) => member.id)
    ).filter((edgeId) => !(input.edgeIds ?? []).includes(edgeId)).flatMap((edgeId) => {
      const edge = ctx.read.edge.item.get(edgeId)?.edge
      return edge ? [edge] : []
    })
  }
}

export const startNodeDragPhase = (
  ctx: NodeDragRuntimeDeps,
  input: NodeDragPhaseInput
): ActiveInteraction | null => {
  const state = createNodeDragState(ctx, {
    pointerId: input.start.pointerId,
    startWorld: input.start.point.world,
    frame: input.frame,
    anchorId: input.anchorId,
    nodeIds: input.target.nodeIds,
    edgeIds: input.target.edgeIds,
    allowCross: input.input.altKey
  })
  if (!state) {
    return null
  }

  if (input.nextSelection) {
    ctx.commands.selection.replace(input.nextSelection)
  }

  clearNodeDrag(ctx)
  updateNodeDragPreview(ctx, state, {
    clientX: input.input.client.x,
    clientY: input.input.client.y
  })

  return {
    mode: 'node-drag',
    pointerId: input.start.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        updateNodeDragPreview(ctx, state, pointer)
      }
    },
    move: (next) => {
      state.allowCross = next.altKey
      updateNodeDragPreview(ctx, state, {
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
