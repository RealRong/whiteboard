import {
  finishMoveSession,
  startMoveSession,
  stepMoveSession
} from '@whiteboard/core/node'
import type { SelectionTarget } from '@whiteboard/core/selection'
import type { Edge } from '@whiteboard/core/types'
import type {
  InteractionCtx,
  InteractionSession
} from '../../runtime/interaction'
import type {
  PointerDownInput
} from '../../types/input'
import {
  clearSelectionPreview,
  writeSelectionMovePreview
} from './overlay'

type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'config' | 'commands' | 'overlay' | 'snap'
>

type MoveInteractionInput = {
  start: PointerDownInput
  target: SelectionTarget
  prepareSelection?: SelectionTarget
}

export const createMoveInteraction = (
  ctx: SelectionInteractionCtx,
  input: MoveInteractionInput
): InteractionSession | null => {
  const initialSession = startMoveSession({
    nodes: ctx.read.index.node.all().map((entry) => entry.node),
    edges: ctx.read.edge.list.get()
      .map((edgeId) => ctx.read.edge.item.get(edgeId)?.edge)
      .filter((edge): edge is Edge => Boolean(edge)),
    intent: {
      target: input.target
    },
    startWorld: input.start.world,
    nodeSize: ctx.config.nodeSize
  })
  if (!initialSession) {
    return null
  }
  let session = initialSession

  if (input.prepareSelection) {
    ctx.commands.selection.replace(input.prepareSelection)
  }
  let allowCross = false

  const project = (
    world: {
      x: number
      y: number
    },
    nextAllowCross: boolean
  ) => {
    allowCross = nextAllowCross
    const result = stepMoveSession({
      session,
      pointerWorld: world,
      allowCross: nextAllowCross,
      snap: ctx.read.tool.is('select')
        ? ({ rect, excludeIds, allowCross: nextAllowCross }) => ctx.snap.node.move({
            rect,
            excludeIds,
            allowCross: nextAllowCross
          })
        : undefined
    })

    session = result.session
    writeSelectionMovePreview(ctx, result)
  }

  clearSelectionPreview(ctx)

  return {
    mode: 'node-drag',
    pointerId: input.start.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        project(
          ctx.read.viewport.pointer(pointer).world,
          allowCross
        )
      }
    },
    move: (next) => {
      project(next.world, next.modifiers.alt)
    },
    up: () => {
      const commit = finishMoveSession(session)

      if (commit.delta) {
        ctx.commands.node.move({
          ids: session.move.rootIds,
          delta: commit.delta
        })
      }

      if (commit.edges.length > 0) {
        ctx.commands.edge.updateMany(commit.edges)
      }
    },
    cleanup: () => {
      clearSelectionPreview(ctx)
    }
  }
}
