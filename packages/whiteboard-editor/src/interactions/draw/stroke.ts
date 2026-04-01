import {
  resolveDrawPoints,
  resolveDrawStroke
} from '@whiteboard/core/node'
import type { Point } from '@whiteboard/core/types'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../runtime/interaction'
import type { EditorPointerSample } from '../types/editor'
import type { DrawBrushKind } from '../types/tool'
import type {
  DrawPreview,
  ResolvedDrawStyle
} from '../types/draw'
import type { FeatureRuntime } from '../runtime/editor/createEditor'

const DRAW_MIN_LENGTH_SCREEN = 4
const SAMPLE_DISTANCE_SCREEN = 1

export type DrawStrokeState = {
  kind: DrawBrushKind
  style: ResolvedDrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

type DrawStrokeInteractionDeps = {
  readZoom: () => number
  readStyle: (kind: DrawBrushKind) => ResolvedDrawStyle
  createNode: FeatureRuntime['command']['node']['create']
  writePreview: (preview: DrawPreview | null) => void
  clearPreview: () => void
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
  deps: DrawStrokeInteractionDeps,
  points: readonly Point[]
) => resolveDrawPoints({
  points,
  zoom: deps.readZoom()
})

const writeStrokePreview = (
  deps: DrawStrokeInteractionDeps,
  state: DrawStrokeState
) => {
  deps.writePreview({
    kind: state.kind,
    style: state.style,
    points: resolveStrokePoints(deps, state.points)
  })
}

const appendStrokeSample = (
  state: DrawStrokeState,
  sample: EditorPointerSample,
  force = false
) => {
  const previous = state.points[state.points.length - 1]

  if (!force && !hasMovedEnough(state.lastScreen, sample.screen)) {
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

const appendStrokeInput = (
  deps: DrawStrokeInteractionDeps,
  state: DrawStrokeState,
  input: InteractionPointerInput,
  force = false
) => {
  let changed = false

  for (let index = 0; index < input.samples.length; index += 1) {
    changed = appendStrokeSample(
      state,
      input.samples[index]!,
      force && index === input.samples.length - 1
    ) || changed
  }

  if (changed) {
    writeStrokePreview(deps, state)
  }
}

const commitStroke = (
  deps: DrawStrokeInteractionDeps,
  state: DrawStrokeState
) => {
  if (
    state.points.length < 2
    || state.lengthScreen < DRAW_MIN_LENGTH_SCREEN
  ) {
    return
  }

  const stroke = resolveDrawStroke({
    points: resolveStrokePoints(deps, state.points),
    width: state.style.width
  })
  if (!stroke) {
    return
  }

  deps.createNode({
    type: 'draw',
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

export const createDrawStrokeInteraction = (
  deps: DrawStrokeInteractionDeps
): InteractionRegistration<DrawStrokeState> => ({
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

    return {
      kind: input.tool.kind,
      style: deps.readStyle(input.tool.kind),
      points: [input.point.world],
      lastScreen: input.point.screen,
      lengthScreen: 0
    }
  },
  move: ({ state }, input) => {
    appendStrokeInput(deps, state, input)
  },
  up: ({ state, session }, input) => {
    appendStrokeInput(deps, state, input, true)
    commitStroke(deps, state)
    session.finish()
  },
  cleanup: () => {
    deps.clearPreview()
  }
})
