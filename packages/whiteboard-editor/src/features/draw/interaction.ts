import {
  resolveDrawPoints,
  resolveDrawStroke
} from '@whiteboard/core/node'
import { getSegmentBounds } from '@whiteboard/core/geometry'
import type {
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import {
  createRafValueStore,
  type ReadStore
} from '@whiteboard/engine'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../runtime/interaction'
import type { EditorPointerSample } from '../../types/editor'
import type { DrawBrushKind } from '../../types/tool'
import type {
  DrawPreview,
  ResolvedDrawStyle
} from '../../types/draw'
import type { EditorFeatureContext } from '../../types/runtime/editor/featureContext'
import {
  readDrawStyle
} from '../../draw/model'

const DRAW_MIN_LENGTH_SCREEN = 4
const SAMPLE_DISTANCE_SCREEN = 1
const ERASER_HIT_EPSILON_SCREEN = 2
const ZOOM_EPSILON = 0.0001

type StrokeState = {
  ownerId?: NodeId
  kind: DrawBrushKind
  style: ResolvedDrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

type EraseState = {
  ids: Set<NodeId>
  lastWorld: Point
}

type DrawInteractionDeps = Pick<
  EditorFeatureContext,
  'read' | 'commands' | 'viewport' | 'projection'
>

export type DrawInteraction = {
  preview: ReadStore<DrawPreview | null>
  interactions: readonly InteractionRegistration[]
  clear: () => void
}

const hasMovedEnough = (
  left: Point,
  right: Point
) => {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return (dx * dx) + (dy * dy) >= SAMPLE_DISTANCE_SCREEN * SAMPLE_DISTANCE_SCREEN
}

export const createDrawInteraction = (
  ctx: DrawInteractionDeps
): DrawInteraction => {
  const previewStore = createRafValueStore<DrawPreview | null>({
    initial: null,
    isEqual: (left, right) => left === right
  })

  const resolvePoints = (
    points: readonly Point[]
  ) => {
    const zoom = ctx.viewport.get().zoom
    return resolveDrawPoints({
      points,
      zoom
    })
  }

  const writePreview = (
    preview: DrawPreview | null
  ) => {
    if (!preview) {
      previewStore.clear()
      return
    }

    previewStore.write(preview)
  }

  const syncStrokePreview = (
    state: StrokeState | null
  ) => {
    if (!state) {
      writePreview(null)
      return
    }

    writePreview({
      kind: state.kind,
      style: state.style,
      points: resolvePoints(state.points)
    })
  }

  const syncHidden = (
    state: EraseState | null
  ) => {
    if (!state) {
      ctx.projection.node.hidden.clear()
      return
    }

    ctx.projection.node.hidden.write([...state.ids])
  }

  const clear = () => {
    writePreview(null)
    syncHidden(null)
  }

  const pushPoint = (
    state: StrokeState,
    sample: EditorPointerSample,
    force = false
  ) => {
    const previous = state.points[state.points.length - 1]

    if (
      !force
      && !hasMovedEnough(state.lastScreen, sample.screen)
    ) {
      return false
    }

    if (
      previous
      && previous.x === sample.world.x
      && previous.y === sample.world.y
    ) {
      state.lastScreen = sample.screen
      return false
    }

    state.points.push(sample.world)
    state.lengthScreen += Math.hypot(
      sample.screen.x - state.lastScreen.x,
      sample.screen.y - state.lastScreen.y
    )
    state.lastScreen = sample.screen
    return true
  }

  const pushEventPoints = (
    state: StrokeState,
    input: InteractionPointerInput,
    force = false
  ) => {
    let changed = false
    const samples = input.samples

    for (let index = 0; index < samples.length; index += 1) {
      changed = pushPoint(
        state,
        samples[index]!,
        force && index === samples.length - 1
      ) || changed
    }

    if (changed) {
      syncStrokePreview(state)
    }
  }

  const commitStroke = (
    state: StrokeState
  ) => {
    if (
      state.points.length < 2
      || state.lengthScreen < DRAW_MIN_LENGTH_SCREEN
    ) {
      return
    }

    const points = resolvePoints(state.points)
    const stroke = resolveDrawStroke({
      points,
      width: state.style.width
    })
    if (!stroke) {
      return
    }

    ctx.commands.node.create({
      type: 'draw',
      ownerId: state.ownerId,
      position: stroke.position,
      size: stroke.size,
      data: {
        points: stroke.points,
        baseSize: stroke.size
      },
      style: {
        stroke: state.style.color,
        strokeWidth: state.style.width,
        opacity: state.style.opacity
      }
    })
  }

  const collectRect = (
    state: EraseState,
    rect: Rect
  ) => {
    const nodeIds = ctx.read.node.idsInRect(rect, {
      match: 'touch'
    })
    let changed = false

    nodeIds.forEach((nodeId) => {
      const item = ctx.read.node.item.get(nodeId)
      if (!item || item.node.type !== 'draw' || state.ids.has(nodeId)) {
        return
      }

      state.ids.add(nodeId)
      changed = true
    })

    if (changed) {
      syncHidden(state)
    }
  }

  const collectPoint = (
    state: EraseState,
    world: Point
  ) => {
    const halfWorld = ERASER_HIT_EPSILON_SCREEN / Math.max(ctx.viewport.get().zoom, ZOOM_EPSILON)
    collectRect(state, getSegmentBounds(state.lastWorld, world, halfWorld))
    state.lastWorld = world
  }

  const collectEvent = (
    state: EraseState,
    input: InteractionPointerInput
  ) => {
    const samples = input.samples

    for (let index = 0; index < samples.length; index += 1) {
      collectPoint(state, samples[index]!.world)
    }
  }

  const stroke: InteractionRegistration<StrokeState> = {
    key: 'draw.stroke',
    priority: 600,
    mode: 'draw',
    can: (input) => {
      if (
        input.tool.type !== 'draw'
        || input.tool.kind === 'eraser'
        || input.pick.kind !== 'background'
        || input.editable
        || input.ignoreInput
        || input.ignoreSelection
      ) {
        return null
      }

      const frameTargetId = input.frame.id ?? ctx.read.node.frameAt(input.point.world)
      return {
        ownerId: input.frame.id ?? frameTargetId,
        kind: input.tool.kind,
        style: readDrawStyle(ctx.read.draw.preferences.get(), input.tool.kind),
        points: [input.point.world],
        lastScreen: input.point.screen,
        lengthScreen: 0
      }
    },
    start: ({ input }) => {
      void input
    },
    move: ({ state }, input) => {
      pushEventPoints(state, input)
    },
    up: ({ state, session }, input) => {
      pushEventPoints(state, input, true)
      commitStroke(state)
      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  const erase: InteractionRegistration<EraseState> = {
    key: 'draw.erase',
    priority: 610,
    mode: 'draw',
    can: (input) => {
      if (
        input.tool.type !== 'draw'
        || input.tool.kind !== 'eraser'
        || input.editable
        || input.ignoreInput
      ) {
        return null
      }

      return {
        ids: new Set<NodeId>(),
        lastWorld: input.point.world
      }
    },
    start: ({ input, state }) => {
      collectPoint(state, input.point.world)
      syncHidden(state)
    },
    move: ({ state }, input) => {
      collectEvent(state, input)
    },
    up: ({ state, session }, input) => {
      collectEvent(state, input)
      if (state.ids.size > 0) {
        ctx.commands.node.delete([...state.ids])
      }
      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  return {
    preview: {
      get: previewStore.get,
      subscribe: previewStore.subscribe
    },
    interactions: [
      erase,
      stroke
    ],
    clear
  }
}
