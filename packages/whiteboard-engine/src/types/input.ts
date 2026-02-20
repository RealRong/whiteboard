import type { EdgeId, NodeId } from '@whiteboard/core'
import type { PointerInput } from './common'
import type { Commands } from './commands'
import type { InstanceConfig } from './instance/config'
import type { Query } from './instance/query'
import type { Runtime, RuntimeServices } from './instance/runtime'
import type { State } from './instance/state'
import type { ShortcutContext, Shortcuts } from './shortcuts'

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel'
export type PointerStage = 'capture' | 'bubble'

export type PointerInputEvent = {
  kind: 'pointer'
  stage: PointerStage
  phase: PointerPhase
  pointer: PointerInput
  pointerId: number
  pointerType: 'mouse' | 'pen' | 'touch' | 'unknown'
  button: number
  buttons: number
  client: { x: number; y: number }
  screen: { x: number; y: number }
  modifiers: {
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
    space: boolean
  }
  target: {
    surface: 'canvas' | 'overlay' | 'ui' | 'unknown'
    role?: 'node' | 'edge' | 'handle' | 'background'
    nodeId?: NodeId
    edgeId?: EdgeId
  }
  timestamp: number
  source: 'container' | 'window' | 'program'
}

export type WheelInputEvent = {
  kind: 'wheel'
  client: { x: number; y: number }
  deltaX: number
  deltaY: number
  deltaZ: number
  modifiers: {
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
  }
  timestamp: number
  source: 'container' | 'window' | 'program'
}

export type KeyInputEvent = {
  kind: 'key'
  phase: 'down' | 'up'
  key: string
  code: string
  repeat: boolean
  modifiers: {
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
  }
  isComposing?: boolean
  timestamp: number
  source: 'container' | 'window' | 'program'
}

export type FocusInputEvent = {
  kind: 'focus'
  phase: 'focus' | 'blur'
  timestamp: number
  source: 'container' | 'window' | 'program'
}

export type CompositionInputEvent = {
  kind: 'composition'
  phase: 'start' | 'update' | 'end'
  data?: string
  timestamp: number
  source: 'container' | 'window' | 'program'
}

export type InputEvent =
  | PointerInputEvent
  | WheelInputEvent
  | KeyInputEvent
  | FocusInputEvent
  | CompositionInputEvent

export type InputEffect =
  | { type: 'capturePointer'; pointerId: number }
  | { type: 'releasePointer'; pointerId: number }
  | { type: 'setWindowPointerTracking'; enabled: boolean }
  | { type: 'preventDefault'; reason: string }
  | { type: 'stopPropagation'; reason: string }
  | { type: 'setCursor'; cursor: string }
  | { type: 'requestRender'; reason: string }

export type InputCommand = InputEffect

export type InputResult = {
  effects: InputEffect[]
}

export type InputDispatchResult = InputResult

export type InputConfig = {
  viewport: {
    minZoom: number
    maxZoom: number
    enablePan: boolean
    enableWheel: boolean
    wheelSensitivity: number
  }
}

export type InputSessionContext = {
  state: Pick<State, 'read' | 'write' | 'batch'>
  commands: Commands
  query: Query
  runtime: Pick<Runtime, 'viewport' | 'interaction'>
  services: Pick<RuntimeServices, 'viewportNavigation'>
  shortcuts: Pick<Shortcuts, 'handlePointerDownCapture' | 'handleKeyDown'>
  view: {
    getShortcutContext: () => ShortcutContext
  }
  input: {
    config: InputConfig
  }
  config: InstanceConfig
}

export type InputController = {
  handle: (event: InputEvent) => InputResult
  configure: (config: InputConfig) => void
  reset: (reason?: CancelReason) => InputResult
}

export type InputPort = InputController

export type CancelReason =
  | 'pointercancel'
  | 'blur'
  | 'escape'
  | 'forced'

export type PointerSessionKind =
  | 'nodeDrag'
  | 'nodeTransform'
  | 'viewportPan'
  | 'selectionBox'
  | 'edgeConnect'
  | 'routingDrag'
  | 'mindmapDrag'

export type PointerSessionRuntime = {
  pointerId: number
  update: (
    event: PointerInputEvent,
    context: InputSessionContext
  ) => void
  end: (
    event: PointerInputEvent,
    context: InputSessionContext
  ) => void
  cancel: (
    reason: CancelReason,
    context: InputSessionContext
  ) => void
}

export type PointerSession = {
  kind: PointerSessionKind
  priority: number
  canStart: (event: PointerInputEvent, context: InputSessionContext) => boolean
  start: (
    event: PointerInputEvent,
    context: InputSessionContext
  ) => PointerSessionRuntime | null
}
