import { getSegmentBounds } from '@whiteboard/core/geometry'
import {
  resolveDrawPoints,
  resolveDrawStroke
} from '@whiteboard/core/node'
import type {
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type {
  InteractionControl,
  InteractionOwner,
  InteractionSession
} from '../../runtime/interaction'
import type {
  PointerDownInput,
  PointerMoveInput,
  PointerSample,
  PointerUpInput
} from '../../types/input'
import type { InteractionCtx } from '../../runtime/interaction/ctx'
import type { DrawBrushKind } from '../../types/tool'
import type {
  DrawPreview,
  ResolvedDrawStyle
} from '../../types/draw'
import { readDrawStyle } from '../../draw/model'

const DRAW_MIN_LENGTH_SCREEN = 4
const SAMPLE_DISTANCE_SCREEN = 1
const ERASER_HIT_EPSILON_SCREEN = 2
const ZOOM_EPSILON = 0.0001

type DrawInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'commands' | 'overlay'
>

type StrokeSession = {
  kind: 'stroke'
  brush: DrawBrushKind
  style: ResolvedDrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

type EraseSession = {
  kind: 'erase'
  ids: Set<NodeId>
  lastWorld: Point
}

type DrawSession = StrokeSession | EraseSession

export type DrawInteraction = {
  owner: InteractionOwner
  clear: () => void
}

const readZoom = (
  ctx: DrawInteractionCtx
) => ctx.state.viewport.read.get().zoom

const readStyle = (
  ctx: DrawInteractionCtx,
  kind: DrawBrushKind
) => readDrawStyle(
  ctx.state.drawPreferences.store.get(),
  kind
)

const queryDrawNodeIdsInRect = (
  ctx: DrawInteractionCtx,
  rect: Rect
): readonly NodeId[] => ctx.read.node.idsInRect(rect, {
  match: 'touch'
}).filter((nodeId) => (
  ctx.read.node.item.get(nodeId)?.node.type === 'draw'
))

const writeDrawPreview = (
  ctx: DrawInteractionCtx,
  preview: DrawPreview | null
) => {
  ctx.overlay.set((current) => (
    current.draw.preview === preview
      ? current
      : {
          ...current,
          draw: {
            preview
          }
        }
  ))
}

const clearDrawPreview = (
  ctx: DrawInteractionCtx
) => {
  writeDrawPreview(ctx, null)
}

const writeHiddenNodes = (
  ctx: DrawInteractionCtx,
  nodeIds: readonly NodeId[]
) => {
  ctx.overlay.set((current) => ({
    ...current,
    node: {
      ...current.node,
      hidden: nodeIds
    }
  }))
}

const clearHiddenNodes = (
  ctx: DrawInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.node.hidden.length === 0
      ? current
      : {
          ...current,
          node: {
            ...current.node,
            hidden: []
          }
        }
  ))
}

const clearDrawOverlay = (
  ctx: DrawInteractionCtx
) => {
  clearDrawPreview(ctx)
  clearHiddenNodes(ctx)
}

const hasMovedEnough = (
  left: Point,
  right: Point
) => {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return (dx * dx) + (dy * dy) >= SAMPLE_DISTANCE_SCREEN * SAMPLE_DISTANCE_SCREEN
}

const resolveStrokePoints = (
  ctx: DrawInteractionCtx,
  points: readonly Point[]
) => resolveDrawPoints({
  points,
  zoom: readZoom(ctx)
})

const writeStrokePreview = (
  ctx: DrawInteractionCtx,
  session: StrokeSession
) => {
  writeDrawPreview(ctx, {
    kind: session.brush,
    style: session.style,
    points: resolveStrokePoints(ctx, session.points)
  })
}

const appendStrokeSample = (
  session: StrokeSession,
  sample: PointerSample,
  force = false
) => {
  const previous = session.points[session.points.length - 1]

  if (!force && !hasMovedEnough(session.lastScreen, sample.screen)) {
    return false
  }

  if (
    previous
    && previous.x === sample.world.x
    && previous.y === sample.world.y
  ) {
    session.lastScreen = sample.screen
    return false
  }

  session.points.push(sample.world)
  session.lengthScreen += Math.hypot(
    sample.screen.x - session.lastScreen.x,
    sample.screen.y - session.lastScreen.y
  )
  session.lastScreen = sample.screen
  return true
}

const moveStroke = (
  ctx: DrawInteractionCtx,
  session: StrokeSession,
  input: PointerMoveInput | PointerUpInput,
  force = false
) => {
  let changed = false

  for (let index = 0; index < input.samples.length; index += 1) {
    changed = appendStrokeSample(
      session,
      input.samples[index]!,
      force && index === input.samples.length - 1
    ) || changed
  }

  if (changed) {
    writeStrokePreview(ctx, session)
  }
}

const commitStroke = (
  ctx: DrawInteractionCtx,
  session: StrokeSession
) => {
  if (
    session.points.length < 2
    || session.lengthScreen < DRAW_MIN_LENGTH_SCREEN
  ) {
    return
  }

  const stroke = resolveDrawStroke({
    points: resolveStrokePoints(ctx, session.points),
    width: session.style.width
  })
  if (!stroke) {
    return
  }

  ctx.commands.node.create({
    type: 'draw',
    position: stroke.position,
    size: stroke.size,
    data: {
      points: stroke.points,
      baseSize: stroke.size
    },
    style: {
      stroke: session.style.color,
      strokeWidth: session.style.width,
      opacity: session.style.opacity
    }
  })
}

const startStrokeSession = (
  ctx: DrawInteractionCtx,
  input: PointerDownInput
): StrokeSession | null => {
  const tool = ctx.read.tool.get()

  if (
    tool.type !== 'draw'
    || tool.kind === 'eraser'
    || input.pick.kind !== 'background'
    || input.editable
    || input.ignoreInput
    || input.ignoreSelection
  ) {
    return null
  }

  return {
    kind: 'stroke',
    brush: tool.kind,
    style: readStyle(ctx, tool.kind),
    points: [input.world],
    lastScreen: input.screen,
    lengthScreen: 0
  }
}

const collectErasePoint = (
  ctx: DrawInteractionCtx,
  session: EraseSession,
  world: Point
) => {
  const halfWorld =
    ERASER_HIT_EPSILON_SCREEN
    / Math.max(readZoom(ctx), ZOOM_EPSILON)
  const nodeIds = queryDrawNodeIdsInRect(
    ctx,
    getSegmentBounds(session.lastWorld, world, halfWorld)
  )
  let changed = false

  for (let index = 0; index < nodeIds.length; index += 1) {
    const nodeId = nodeIds[index]!
    if (session.ids.has(nodeId)) {
      continue
    }

    session.ids.add(nodeId)
    changed = true
  }

  session.lastWorld = world
  if (changed) {
    writeHiddenNodes(ctx, [...session.ids])
  }
}

const moveErase = (
  ctx: DrawInteractionCtx,
  session: EraseSession,
  input: PointerMoveInput | PointerUpInput
) => {
  for (let index = 0; index < input.samples.length; index += 1) {
    collectErasePoint(ctx, session, input.samples[index]!.world)
  }
}

const commitErase = (
  ctx: DrawInteractionCtx,
  session: EraseSession
) => {
  if (session.ids.size > 0) {
    ctx.commands.node.delete([...session.ids])
  }
}

const startEraseSession = (
  ctx: DrawInteractionCtx,
  input: PointerDownInput
): EraseSession | null => {
  const tool = ctx.read.tool.get()

  if (
    tool.type !== 'draw'
    || tool.kind !== 'eraser'
    || input.editable
    || input.ignoreInput
  ) {
    return null
  }

  const session: EraseSession = {
    kind: 'erase',
    ids: new Set<NodeId>(),
    lastWorld: input.world
  }

  collectErasePoint(ctx, session, input.world)
  writeHiddenNodes(ctx, [...session.ids])
  return session
}

const createDrawSession = (
  ctx: DrawInteractionCtx,
  session: DrawSession,
  control: InteractionControl
): InteractionSession => {
  if (session.kind === 'erase') {
    return {
      mode: 'draw',
      move: (input) => {
        moveErase(ctx, session, input)
      },
      up: (input) => {
        moveErase(ctx, session, input)
        commitErase(ctx, session)
        control.finish()
      },
      cleanup: () => {
        clearHiddenNodes(ctx)
      }
    }
  }

  return {
    mode: 'draw',
    move: (input) => {
      moveStroke(ctx, session, input)
    },
    up: (input) => {
      moveStroke(ctx, session, input, true)
      commitStroke(ctx, session)
      control.finish()
    },
    cleanup: () => {
      clearDrawPreview(ctx)
    }
  }
}

export const createDrawInteraction = (
  ctx: DrawInteractionCtx
): DrawInteraction => ({
  owner: {
    key: 'draw',
    priority: 600,
    start: (input, control) => {
      const session =
        startEraseSession(ctx, input)
        ?? startStrokeSession(ctx, input)

      return session
        ? createDrawSession(ctx, session, control)
        : null
    }
  },
  clear: () => {
    clearDrawOverlay(ctx)
  }
})
