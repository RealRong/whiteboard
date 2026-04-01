import { getSegmentBounds } from '@whiteboard/core/geometry'
import type {
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type {
  ActiveInteraction,
  InteractionControl,
  InteractionPointerInput
} from '../../runtime/interaction'
import type { PointerDown } from '../../runtime/input/pointer'
import type { InteractionHost } from '../../runtime/interaction/host'

const ERASER_HIT_EPSILON_SCREEN = 2
const ZOOM_EPSILON = 0.0001

type EraseState = {
  ids: Set<NodeId>
  lastWorld: Point
}

type ErasePhaseDeps = {
  readZoom: () => number
  queryDrawNodeIdsInRect: (rect: Rect) => readonly NodeId[]
  deleteNodes: InteractionHost['commands']['node']['delete']
  writeHidden: (nodeIds: readonly NodeId[]) => void
  clearHidden: () => void
}

const collectEraseHitsInRect = (
  deps: ErasePhaseDeps,
  state: EraseState,
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
  deps: ErasePhaseDeps,
  state: EraseState,
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
  deps: ErasePhaseDeps,
  state: EraseState,
  input: InteractionPointerInput
) => {
  for (let index = 0; index < input.samples.length; index += 1) {
    collectErasePoint(deps, state, input.samples[index]!.world)
  }
}

export const startErasePhase = (
  deps: ErasePhaseDeps,
  input: PointerDown,
  control: InteractionControl
): ActiveInteraction | null => {
  if (
    input.tool.type !== 'draw'
    || input.tool.kind !== 'eraser'
    || input.editable
    || input.ignoreInput
  ) {
    return null
  }

  const state: EraseState = {
    ids: new Set<NodeId>(),
    lastWorld: input.point.world
  }

  collectErasePoint(deps, state, input.point.world)
  deps.writeHidden([...state.ids])

  return {
    mode: 'draw',
    move: (event) => {
      collectEraseInput(deps, state, event)
    },
    up: (event) => {
      collectEraseInput(deps, state, event)
      if (state.ids.size > 0) {
        deps.deleteNodes([...state.ids])
      }
      control.finish()
    },
    cleanup: () => {
      deps.clearHidden()
    }
  }
}
