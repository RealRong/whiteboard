export { createInteractionCoordinator } from './coordinator'
export { createPressRuntime } from './press'
export { createSnapRuntime } from './snap'
export type {
  InteractionCoordinator,
  InteractionMode
} from './types'
export type {
  MoveSnapInput,
  ResizeSnapInput,
  ResizeSnapSource,
  SnapRuntime
} from './snap'

export const GestureTuning = {
  dragMinDistance: 3,
  holdDelay: 700
} as const
