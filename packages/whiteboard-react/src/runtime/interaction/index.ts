export { createInteractionCoordinator } from './coordinator'
export { createPressRuntime } from './press'
export type {
  InteractionCoordinator,
  InteractionMode
} from './types'

export const GestureTuning = {
  dragMinDistance: 3,
  holdDelay: 700
} as const
