import {
  moveEdge,
  toEdgeProjectionPatchEntry
} from '@whiteboard/core/edge'
import {
  buildMoveSet,
  resolveMoveEffect,
  type MoveSet
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { EditorRuntime } from '../../../types/internal/editor'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { SnapRuntime } from '../../../runtime/interaction'
import type { EdgeProjection } from '../../edge/projection'
import type { NodeProjectionRuntime } from '../projection/store'

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
  capture: Element
  start: Point
  frame: Rect
  anchorId: NodeId
  nodeIds: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  event: PointerEvent
  onStart?: () => void
}

export type NodeDragInteraction = {
  interaction: InteractionRegistration<ActiveDrag, NodeDragStart>
  createState: (input: NodeDragStart) => ActiveDrag | null
  clear: () => void
}

type NodeDragInteractionDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      model: {
        node: Pick<NodeProjectionRuntime, 'preview'>
      }
      overlay: {
        edge: Pick<EdgeProjection, 'clearPatch' | 'writeEntries'>
      }
    }
    snap: Pick<SnapRuntime, 'node'>
  }
}

export const createNodeDragInteraction = (
  editor: NodeDragInteractionDeps
): NodeDragInteraction => {
  const clear = () => {
    editor.internals.projections.model.node.preview.clear()
    editor.internals.snap.node.clear()
    editor.internals.projections.overlay.edge.clearPatch()
  }

  const readCanvasNodes = () => editor.read.index.node.all().map((entry) => entry.node)

  const commit = (state: ActiveDrag) => {
    if (state.last.x !== 0 || state.last.y !== 0) {
      editor.commands.node.move({
        ids: state.ids,
        delta: state.last
      })
    }

    const edgeUpdates = state.selectedEdgeIds.flatMap((edgeId) => {
      const edge = editor.read.edge.view.get(edgeId)?.edge
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
      editor.commands.edge.updateMany(edgeUpdates)
    }
  }

  const updatePreview = (
    state: ActiveDrag,
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const world = editor.viewport.pointer(input).world
    const rawPosition = {
      x: state.origin.x + (world.x - state.startWorld.x),
      y: state.origin.y + (world.y - state.startWorld.y)
    }
    const snapped = editor.internals.snap.node.move({
      rect: {
        x: rawPosition.x,
        y: rawPosition.y,
        width: state.size.width,
        height: state.size.height
      },
      excludeIds: state.move.members.map((member) => member.id),
      allowCross: state.allowCross,
      disabled: !editor.read.tool.is('select')
    })
    const delta = {
      x: snapped.x - state.origin.x,
      y: snapped.y - state.origin.y
    }
    const preview = resolveMoveEffect({
      nodes: readCanvasNodes(),
      edges: state.relatedEdgeIds
        .map((edgeId) => editor.read.edge.view.get(edgeId)?.edge)
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
      move: state.move,
      delta,
      nodeSize: editor.config.nodeSize
    })
    state.last = delta
    const selectedEdgeUpdates = state.selectedEdgeIds.flatMap((edgeId) => {
      const edge = editor.read.edge.view.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, delta)
      if (!patch) {
        return []
      }

      return [toEdgeProjectionPatchEntry(edgeId, patch)]
    })

    editor.internals.projections.model.node.preview.write({
      patches: preview.nodes,
      hoveredContainerId: preview.hoveredContainerId
    })
    editor.internals.projections.overlay.edge.writeEntries(
      [
        ...selectedEdgeUpdates,
        ...preview.edges.map(({ id, patch }) => ({
          id,
          route: patch.route
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
      ids
    })
    if (!move.members.length) {
      return null
    }

    return {
      ids,
      move,
      startWorld: input.start,
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
      allowCross: input.event.altKey,
      selectedEdgeIds: input.edgeIds ?? [],
      relatedEdgeIds: editor.read.edge.related(
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
      session.pan(input.event)
      updatePreview(state, input.event)
      if (input.event.cancelable) {
        input.event.preventDefault()
      }
    },
    move: ({ state, session }, input: InteractionPointerInput) => {
      state.allowCross = input.altKey
      session.pan(input.raw)
      updatePreview(state, input.raw)
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
