import {
  moveEdge
} from '@whiteboard/core/edge'
import {
  buildMoveSet,
  resolveMoveEffect,
  type MoveSet
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { EditorRuntime } from '../../../runtime/editor/types'
import type { SnapRuntime } from '../../../runtime/interaction'
import {
  type EdgeProjection,
  toEdgeProjectionEntry
} from '../../edge/projection'
import {
  clearNodeProjectionPreview,
  writeNodeProjectionPreview,
  type NodeProjectionRuntime
} from '../projection/store'

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
}

export type NodeDragSession = {
  start: (input: NodeDragStart) => boolean
  cancel: () => void
}

type NodeDragSessionDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      model: {
        node: Pick<NodeProjectionRuntime, 'store'>
      }
      overlay: {
        edge: Pick<EdgeProjection, 'patch'>
      }
    }
    snap: Pick<SnapRuntime, 'node'>
  }
}

export const createNodeDragSession = (
  editor: NodeDragSessionDeps
): NodeDragSession => {
  let active: ActiveDrag | null = null
  let session: ReturnType<typeof editor.interaction.start> = null

  const readCanvasNodes = () => editor.read.index.node.all().map((entry) => entry.node)

  const clear = () => {
    active = null
    session = null
    clearNodeProjectionPreview(editor.internals.projections.model.node.store)
    editor.internals.snap.node.clear()
    editor.internals.projections.overlay.edge.patch.clear()
  }

  const commit = (draft: ActiveDrag) => {
    if (draft.last.x !== 0 || draft.last.y !== 0) {
      editor.commands.node.move({
        ids: draft.ids,
        delta: draft.last
      })
    }

    const edgeUpdates = draft.selectedEdgeIds.flatMap((edgeId) => {
      const edge = editor.read.edge.view.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, draft.last)
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

  const updatePreview = (input: {
    clientX: number
    clientY: number
  }) => {
    if (!active) {
      return
    }

    const world = editor.viewport.pointer(input).world
    const rawPosition = {
      x: active.origin.x + (world.x - active.startWorld.x),
      y: active.origin.y + (world.y - active.startWorld.y)
    }
    const snapped = editor.internals.snap.node.move({
      rect: {
        x: rawPosition.x,
        y: rawPosition.y,
        width: active.size.width,
        height: active.size.height
      },
      excludeIds: active.move.members.map((member) => member.id),
      allowCross: active.allowCross,
      disabled: !editor.read.tool.is('select')
    })
    const delta = {
      x: snapped.x - active.origin.x,
      y: snapped.y - active.origin.y
    }
    const preview = resolveMoveEffect({
      nodes: readCanvasNodes(),
      edges: active.relatedEdgeIds
        .map((edgeId) => editor.read.edge.view.get(edgeId)?.edge)
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
      move: active.move,
      delta,
      nodeSize: editor.config.nodeSize
    })
    active.last = delta
    const selectedEdgeUpdates = active.selectedEdgeIds.flatMap((edgeId) => {
      const edge = editor.read.edge.view.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, delta)
      if (!patch) {
        return []
      }

      return [toEdgeProjectionEntry(edgeId, patch)]
    })

    writeNodeProjectionPreview(editor.internals.projections.model.node.store, {
      patches: preview.nodes,
      hoveredContainerId: preview.hoveredContainerId
    })
    editor.internals.projections.overlay.edge.patch.write(
      [
        ...selectedEdgeUpdates,
        ...preview.edges.map(({ id, patch }) => ({
          id,
          route: patch.route
        }))
      ]
    )
  }

  return {
    start: (input) => {
      const ids = input.nodeIds.includes(input.anchorId)
        ? input.nodeIds
        : [input.anchorId]
      const move = buildMoveSet({
        nodes: readCanvasNodes(),
        ids
      })
      if (!move.members.length) {
        return false
      }

      const nextSession = editor.interaction.start({
        mode: 'node-drag',
        pointerId: input.pointerId,
        capture: input.capture,
        pan: {
          frame: updatePreview
        },
        cleanup: clear,
        move: (event, currentSession) => {
          if (!active) {
            return
          }

          active.allowCross = event.altKey
          currentSession.pan(event)
          updatePreview(event)
        },
        up: (_event, currentSession) => {
          if (!active) {
            return
          }

          commit(active)
          currentSession.finish()
        }
      })
      if (!nextSession) {
        return false
      }

      active = {
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
      session = nextSession
      clearNodeProjectionPreview(editor.internals.projections.model.node.store)
      editor.internals.snap.node.clear()
      nextSession.pan(input.event)
      updatePreview(input.event)

      if (input.event.cancelable) {
        input.event.preventDefault()
      }

      return true
    },
    cancel: () => {
      session?.cancel()
    }
  }
}
