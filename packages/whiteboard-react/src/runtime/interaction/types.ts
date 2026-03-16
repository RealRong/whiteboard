import type { ReadStore } from '@whiteboard/core/runtime'

export type InteractionMode =
  | 'idle'
  | 'viewport-pan'
  | 'selection-box'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'

export type ActiveInteractionMode = Exclude<InteractionMode, 'idle'>

export type AutoPanPointer = Readonly<{
  clientX: number
  clientY: number
}>

export type InteractionSession = Readonly<{
  finish: () => void
  cancel: () => void
  pan: (pointer: AutoPanPointer) => void
}>

export type AutoPanOptions = Readonly<{
  frame?: (
    pointer: AutoPanPointer,
    session: InteractionSession
  ) => void
  threshold?: number
  maxSpeed?: number
}>

export type InteractionStartInput = Readonly<{
  mode: ActiveInteractionMode
  pointerId?: number
  capture?: Element | null
  pan?: AutoPanOptions | false
  cleanup?: () => void
  move?: (
    event: PointerEvent,
    session: InteractionSession
  ) => void
  up?: (
    event: PointerEvent,
    session: InteractionSession
  ) => void
  keydown?: (
    event: KeyboardEvent,
    session: InteractionSession
  ) => void
  keyup?: (
    event: KeyboardEvent,
    session: InteractionSession
  ) => void
  blur?: (session: InteractionSession) => void
}>

export type InteractionCoordinator = {
  mode: ReadStore<InteractionMode>
  start: (input: InteractionStartInput) => InteractionSession | null
  cancel: () => void
}
