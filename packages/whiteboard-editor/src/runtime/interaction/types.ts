import type { ReadStore } from '@whiteboard/engine'
import type { PointerDown } from '../input/pointer'

export type InteractionMode =
  | 'idle'
  | 'press'
  | 'draw'
  | 'viewport-pan'
  | 'marquee'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-drag'
  | 'edge-connect'
  | 'edge-route'

export type ActiveInteractionMode = Exclude<InteractionMode, 'idle'>

export type InteractionState = Readonly<{
  busy: boolean
  chrome: boolean
  mode: InteractionMode
  space: boolean
}>

export type AutoPanPointer = Readonly<{
  clientX: number
  clientY: number
}>

export type InteractionSession = Readonly<{
  finish: () => void
  cancel: () => void
  pan: (pointer: AutoPanPointer) => void
  replace: (input: InteractionSessionInput) => InteractionSession | null
}>

export type AutoPanOptions = Readonly<{
  frame?: (
    pointer: AutoPanPointer,
    session: InteractionSession
  ) => void
  threshold?: number
  maxSpeed?: number
}>

export type InteractionSessionInput = Readonly<{
  mode: ActiveInteractionMode
  pointerId?: number
  capture?: Element | null
  chrome?: boolean
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
  busy: ReadStore<boolean>
  chrome: ReadStore<boolean>
  state: ReadStore<InteractionState>
  space: ReadStore<boolean>
  start: (input: InteractionSessionInput) => InteractionSession | null
  cancel: () => void
  handleKeyDown: (event: KeyboardEvent) => boolean
  handleKeyUp: (event: KeyboardEvent) => boolean
  handleBlur: () => void
}

export type InteractionDriver<
  Start = PointerDown
> = {
  kind: string
  priority?: number
  resolve: (input: PointerDown) => Start | null
  start: (input: Start) => boolean
  cancel?: () => void
}
