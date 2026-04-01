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
  PointerDownInput,
  PointerMoveInput,
  PointerUpInput
} from '../../types/input'

type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'config' | 'commands' | 'overlay' | 'snap'
>

type SessionPointer = PointerMoveInput | PointerUpInput

type MoveInteractionInput = {
  start: PointerDownInput
  pointer: SessionPointer
  target: SelectionTarget
  prepareSelection?: SelectionTarget
}

const clearMoveOverlay = (
  ctx: SelectionInteractionCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.selection.node.patches.length === 0
      && current.selection.node.hovered === undefined
      && current.selection.edge.length === 0
      && current.selection.guides.length === 0
    )
      ? current
      : {
          ...current,
          selection: {
            ...current.selection,
            node: {
              patches: [],
              hovered: undefined
            },
            edge: [],
            guides: []
          }
        }
  ))
}

const projectMoveOverlay = (
  ctx: SelectionInteractionCtx,
  input: ReturnType<typeof stepMoveSession>
) => {
  ctx.overlay.set((current) => ({
    ...current,
    selection: {
      ...current.selection,
      node: {
        patches: input.preview.nodes.map(({ id, position }) => ({
          id,
          patch: {
            position
          }
        })),
        hovered: input.preview.hovered
      },
      edge: input.preview.edges.map(({ id, patch }) => ({
        id,
        patch: {
          route: patch.route,
          source: patch.source,
          target: patch.target
        }
      })),
      guides: input.guides
    }
  }))
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
  let allowCross = input.pointer.modifiers.alt

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
    projectMoveOverlay(ctx, result)
  }

  clearMoveOverlay(ctx)
  project(input.pointer.world, input.pointer.modifiers.alt)

  return {
    mode: 'node-drag',
    pointerId: input.start.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        project(
          ctx.state.viewport.read.pointer(pointer).world,
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
      clearMoveOverlay(ctx)
    }
  }
}
