export { createInteractionCoordinator } from './coordinator'
export { createInteractionRegistry } from './registry'
export { createPressRuntime } from './press'
export { createSnapRuntime } from './snap'
export type { InteractionDriver } from './driver'
export type { InteractionRegistry } from './registry'
export type {
  InteractionCoordinator,
  InteractionMode,
  InteractionState
} from './types'
export type {
  EdgeSnapRuntime,
  MoveSnapInput,
  NodeSnapRuntime,
  ResizeSnapInput,
  ResizeSnapSource,
  SnapRuntime
} from './snap'

export const GestureTuning = {
  dragMinDistance: 3,
  holdDelay: 700
} as const
