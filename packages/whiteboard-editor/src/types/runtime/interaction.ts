import type { Point } from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/engine'
import type { PointerDown } from '../../runtime/input/pointer'
import type {
  EditorKeyboardInput,
  EditorPointerSample
} from '../editor'
import type { EditorPick } from '../pick'

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
  button: number
  client: Point
  screen: Point
  world: Point
  pick: EditorPick
  detail: number
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  buttons: number
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
  samples: readonly EditorPointerSample[]
}>

export type InteractionKeyboardInput = Readonly<Pick<
  EditorKeyboardInput,
  | 'key'
  | 'code'
  | 'repeat'
  | 'modifiers'
  | 'altKey'
  | 'shiftKey'
  | 'ctrlKey'
  | 'metaKey'
>>

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
    input: InteractionKeyboardInput
  ) => void
  keyup?: (
    ctx: InteractionContext<State, Start>,
    input: InteractionKeyboardInput
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
  handlePointerMove: (input: InteractionPointerInput) => boolean
  handlePointerUp: (input: InteractionPointerInput) => boolean
  handlePointerCancel: (input: {
    pointerId: number
  }) => boolean
  cancel: () => void
  handleKeyDown: (input: InteractionKeyboardInput) => boolean
  handleKeyUp: (input: InteractionKeyboardInput) => boolean
  handleBlur: () => void
}

export type InteractionRegistry = {
  start: (input: PointerDown) => boolean
}
