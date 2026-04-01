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
  transforming: boolean
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

export type InteractionControl = Readonly<{
  finish: () => void
  cancel: () => void
  pan: (pointer: AutoPanPointer) => void
  update: (next: {
    mode?: ActiveInteractionMode
    chrome?: boolean
  }) => void
}>

export type AutoPanOptions = Readonly<{
  frame?: (pointer: AutoPanPointer) => void
  threshold?: number
  maxSpeed?: number
}>

export type ActiveInteraction = {
  mode: ActiveInteractionMode
  pointerId?: number
  chrome?: boolean
  autoPan?: AutoPanOptions
  move?: (input: InteractionPointerInput) => void
  up?: (input: InteractionPointerInput) => void
  keydown?: (input: InteractionKeyboardInput) => void
  keyup?: (input: InteractionKeyboardInput) => void
  blur?: () => void
  cancel?: () => void
  cleanup?: () => void
}

export type InteractionRegistration = {
  key: string
  priority?: number
  start: (
    input: PointerDown,
    control: InteractionControl
  ) => ActiveInteraction | null
}

export type InteractionCoordinator = {
  mode: ReadStore<InteractionMode>
  busy: ReadStore<boolean>
  chrome: ReadStore<boolean>
  state: ReadStore<InteractionState>
  space: ReadStore<boolean>
  start: (
    registration: InteractionRegistration,
    input: PointerDown
  ) => boolean
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
