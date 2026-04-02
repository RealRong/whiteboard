import type { ReadStore } from '@whiteboard/engine'
import type {
  KeyboardInput,
  PointerDownInput,
  PointerMoveInput,
  PointerUpInput,
  WheelInput
} from '../../boardRuntime'

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

export type InteractionSessionMode = Exclude<InteractionMode, 'idle'>

export type InteractionState = Readonly<{
  busy: boolean
  chrome: boolean
  mode: InteractionMode
  transforming: boolean
}>

export type AutoPanPointer = Readonly<{
  clientX: number
  clientY: number
}>

export type InteractionKeyboardInput = KeyboardInput

export type InteractionControl = Readonly<{
  finish: () => void
  cancel: () => void
  pan: (pointer: AutoPanPointer) => void
  update: (next: {
    mode?: InteractionSessionMode
    chrome?: boolean
  }) => void
}>

export type AutoPanOptions = Readonly<{
  frame?: (pointer: AutoPanPointer) => void
  threshold?: number
  maxSpeed?: number
}>

export type InteractionSession = {
  mode: InteractionSessionMode
  pointerId?: number
  chrome?: boolean
  autoPan?: AutoPanOptions
  move?: (input: PointerMoveInput) => void
  up?: (input: PointerUpInput) => void
  keydown?: (input: InteractionKeyboardInput) => void
  keyup?: (input: InteractionKeyboardInput) => void
  blur?: () => void
  cancel?: () => void
  cleanup?: () => void
}

export type InteractionStartResult =
  | null
  | {
      kind: 'handled'
    }
  | {
      kind: 'session'
      session: InteractionSession
    }

export type InteractionObserve = {
  move?: (input: PointerMoveInput) => void
  leave?: () => void
  blur?: () => void
  cancel?: () => void
  wheel?: (input: WheelInput) => boolean
}

export type InteractionOwner = {
  key: string
  priority?: number
  start?: (
    input: PointerDownInput,
    control: InteractionControl
  ) => InteractionStartResult
  observe?: InteractionObserve
}

export type InteractionFeature = {
  owner: InteractionOwner
  clear?: () => void
}

export type InteractionRuntime = {
  mode: ReadStore<InteractionMode>
  busy: ReadStore<boolean>
  chrome: ReadStore<boolean>
  state: ReadStore<InteractionState>
  handlePointerDown: (input: PointerDownInput) => boolean
  handlePointerMove: (input: PointerMoveInput) => boolean
  handlePointerUp: (input: PointerUpInput) => boolean
  handlePointerCancel: (input: {
    pointerId: number
  }) => boolean
  handlePointerLeave: () => void
  handleWheel: (input: WheelInput) => boolean
  cancel: () => void
  handleKeyDown: (input: InteractionKeyboardInput) => boolean
  handleKeyUp: (input: InteractionKeyboardInput) => boolean
  handleBlur: () => void
}
