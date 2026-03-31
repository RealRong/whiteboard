import { getSegmentBounds } from '@whiteboard/core/geometry'
import type {
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../runtime/interaction'
import type { FeatureRuntime } from '../runtime/editor/createEditor'

const ERASER_HIT_EPSILON_SCREEN = 2
const ZOOM_EPSILON = 0.0001

export type DrawEraseState = {
  ids: Set<NodeId>
  lastWorld: Point
}

type DrawEraseInteractionDeps = {
  readZoom: () => number
  queryDrawNodeIdsInRect: (rect: Rect) => readonly NodeId[]
  deleteNodes: FeatureRuntime['command']['node']['delete']
  writeHidden: (nodeIds: readonly NodeId[]) => void
  clearHidden: () => void
}

const collectEraseHitsInRect = (
  deps: DrawEraseInteractionDeps,
  state: DrawEraseState,
  rect: Rect
) => {
  const nodeIds = deps.queryDrawNodeIdsInRect(rect)
  let changed = false

  for (let index = 0; index < nodeIds.length; index += 1) {
    const nodeId = nodeIds[index]!
    if (state.ids.has(nodeId)) {
      continue
    }

    state.ids.add(nodeId)
    changed = true
  }

  if (changed) {
    deps.writeHidden([...state.ids])
  }
}

const collectErasePoint = (
  deps: DrawEraseInteractionDeps,
  state: DrawEraseState,
  world: Point
) => {
  const halfWorld =
    ERASER_HIT_EPSILON_SCREEN
    / Math.max(deps.readZoom(), ZOOM_EPSILON)

  collectEraseHitsInRect(
    deps,
    state,
    getSegmentBounds(state.lastWorld, world, halfWorld)
  )
  state.lastWorld = world
}

const collectEraseInput = (
  deps: DrawEraseInteractionDeps,
  state: DrawEraseState,
  input: InteractionPointerInput
) => {
  for (let index = 0; index < input.samples.length; index += 1) {
    collectErasePoint(deps, state, input.samples[index]!.world)
  }
}

export const createDrawEraseInteraction = (
  deps: DrawEraseInteractionDeps
): InteractionRegistration<DrawEraseState> => ({
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
    collectErasePoint(deps, state, input.point.world)
    deps.writeHidden([...state.ids])
  },
  move: ({ state }, input) => {
    collectEraseInput(deps, state, input)
  },
  up: ({ state, session }, input) => {
    collectEraseInput(deps, state, input)
    if (state.ids.size > 0) {
      deps.deleteNodes([...state.ids])
    }
    session.finish()
  },
  cleanup: () => {
    deps.clearHidden()
  }
})
