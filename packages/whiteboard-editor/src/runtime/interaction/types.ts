import type { Point } from '@whiteboard/core/types'
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

export type InteractionPointerInput = Readonly<{
  pointerId: number
  client: Point
  screen: Point
  world: Point
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  buttons: number
  raw: PointerEvent
}>

export type InteractionActivation<
  State = any,
  Start = PointerDown
> = Readonly<{
  registration: InteractionRegistration<State, Start>
  input: Start
  state: State
}>

export type RuntimeSession = Readonly<{
  finish: () => void
  cancel: () => void
  pan: (pointer: AutoPanPointer) => void
  replace: <NextState, NextStart = PointerDown>(
    next: InteractionActivation<NextState, NextStart>
  ) => boolean
}>

export type InteractionContext<
  State = any,
  Start = PointerDown
> = Readonly<{
  input: Start
  state: State
  setState: (next: State) => void
  session: RuntimeSession
}>

export type InteractionCleanupContext<
  State = any,
  Start = PointerDown
> = Readonly<{
  input: Start
  state: State | null
}>

export type AutoPanOptions = Readonly<{
  frame?: (
    pointer: AutoPanPointer,
    session: RuntimeSession
  ) => void
  threshold?: number
  maxSpeed?: number
}>

export type InteractionRegistration<
  State = any,
  Start = PointerDown
> = {
  key: string
  mode: ActiveInteractionMode
  priority?: number
  can?: (input: PointerDown) => State | null
  prepare?: (state: State, input: PointerDown) => Start
  capture?: (state: State, input: Start) => Element | null
  chrome?: (state: State, input: Start) => boolean | undefined
  pan?: AutoPanOptions | ((state: State, input: Start) => AutoPanOptions | false)
  start?: (ctx: InteractionContext<State, Start>) => void
  move?: (
    ctx: InteractionContext<State, Start>,
    input: InteractionPointerInput
  ) => void
  up?: (
    ctx: InteractionContext<State, Start>,
    input: InteractionPointerInput
  ) => void
  keydown?: (
    ctx: InteractionContext<State, Start>,
    event: KeyboardEvent
  ) => void
  keyup?: (
    ctx: InteractionContext<State, Start>,
    event: KeyboardEvent
  ) => void
  blur?: (ctx: InteractionContext<State, Start>) => void
  cancel?: (ctx: InteractionContext<State, Start>) => void
  cleanup?: (ctx: InteractionCleanupContext<State, Start>) => void
}

export type InteractionCoordinator = {
  mode: ReadStore<InteractionMode>
  busy: ReadStore<boolean>
  chrome: ReadStore<boolean>
  state: ReadStore<InteractionState>
  space: ReadStore<boolean>
  start: <State, Start = PointerDown>(
    input: InteractionActivation<State, Start>
  ) => RuntimeSession | null
  cancel: () => void
  handleKeyDown: (event: KeyboardEvent) => boolean
  handleKeyUp: (event: KeyboardEvent) => boolean
  handleBlur: () => void
}

export type InteractionRegistry = {
  start: (input: PointerDown) => boolean
}
