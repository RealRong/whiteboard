import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { PointerInput, Size } from './common'
import type { Commands } from './commands'
import type { RoutingDragPayload } from './edge'
import type { InstanceConfig } from './instance/config'
import type { Query } from './instance/query'
import type { Render } from './instance/render'
import type {
  NodeDragDraft,
  NodeDragUpdateConstraints,
  NodeTransformDraft,
  NodeTransformUpdateConstraints
} from './node'
import type { State } from './instance/state'
import type { Shortcuts } from './shortcuts'

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel'
export type PointerStage = 'capture' | 'bubble'
export type PointerTargetRole = 'node' | 'edge' | 'handle' | 'background'
export type PointerHandleType =
  | 'node-connect'
  | 'edge-routing'
  | 'edge-endpoint'
  | 'mindmap-node'

export type InputTarget = {
  surface: 'canvas' | 'overlay' | 'ui' | 'unknown'
  ignoreInput?: boolean
  isTextInput?: boolean
  role?: PointerTargetRole
  nodeId?: NodeId
  edgeId?: EdgeId
  handleType?: PointerHandleType
  handleSide?: 'top' | 'right' | 'bottom' | 'left'
  routingIndex?: number
  edgeEnd?: 'source' | 'target'
  treeId?: NodeId
}

export type PointerInputEvent = {
  kind: 'pointer'
  stage: PointerStage
  phase: PointerPhase
  clickCount: number
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
  target: InputTarget
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
  target: InputTarget
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

export type InputSessionContext = {
  state: Pick<State, 'read' | 'write' | 'batch' | 'batchFrame'>
  render: Pick<Render, 'read' | 'write' | 'batch' | 'batchFrame'>
  commands: Commands
  query: Query
  nodeInput: {
    drag: {
      begin: (options: {
        nodeId: NodeId
        pointer: PointerInput
      }) => NodeDragDraft | undefined
      updateDraft: (options: {
        draft: NodeDragDraft
        pointer: PointerInput
        constraints: NodeDragUpdateConstraints
      }) => boolean
      commitDraft: (draft: NodeDragDraft) => boolean
      cancelDraft: (options?: { draft?: NodeDragDraft }) => boolean
    }
    transform: {
      beginResize: (options: {
        nodeId: NodeId
        pointer: PointerInput
        handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
        rect: Rect
        rotation: number
      }) => NodeTransformDraft | undefined
      beginRotate: (options: {
        nodeId: NodeId
        pointer: PointerInput
        rect: Rect
        rotation: number
      }) => NodeTransformDraft | undefined
      updateDraft: (options: {
        draft: NodeTransformDraft
        pointer: PointerInput
        constraints: NodeTransformUpdateConstraints
        minSize?: Size
      }) => boolean
      commitDraft: (draft: NodeTransformDraft) => boolean
      cancelDraft: (options?: { draft?: NodeTransformDraft }) => boolean
    }
  }
  edgeInput: {
    routing: {
      begin: (options: {
        edgeId: EdgeId
        index: number
        pointer: PointerInput
      }) => RoutingDragPayload | undefined
      updateDraft: (options: {
        draft: RoutingDragPayload
        pointer: PointerInput
      }) => boolean
      commitDraft: (draft: RoutingDragPayload) => boolean
      cancelDraft: (options?: { draft?: RoutingDragPayload }) => boolean
      insertRoutingPointAt: (edgeId: EdgeId, pointWorld: Point) => boolean
      removeRoutingPointAt: (edgeId: EdgeId, index: number) => boolean
    }
  }
  mindmapInput: {
    drag: {
      start: (treeId: NodeId, nodeId: NodeId, pointer: PointerInput) => boolean
      update: (pointer: PointerInput) => boolean
      end: (pointer: PointerInput) => boolean
      cancel: () => boolean
    }
  }
  selectionInput: {
    box: {
      start: (options: {
        pointerId: number
        screen: Point
        world: Point
        modifiers: Pick<
          PointerInputEvent['modifiers'],
          'alt' | 'shift' | 'ctrl' | 'meta'
        >
      }) => boolean
      update: (options: {
        pointerId: number
        screen: Point
        world: Point
      }) => boolean
      end: (pointerId: number) => boolean
      cancel: (pointerId?: number) => boolean
    }
  }
  inputLifecycle: {
    cancelAll: () => void
    resetTransientState: () => void
  }
  viewport: {
    getZoom: () => number
    clientToWorld: (clientX: number, clientY: number) => Point
  }
  shortcuts: Pick<Shortcuts, 'handlePointerDownCapture' | 'handleKeyDown'>
  config: InstanceConfig
}

export type InputController = {
  handle: (event: InputEvent) => InputResult
  reset: (reason?: CancelReason) => InputResult
  resetAll: (reason?: CancelReason) => InputResult
}

export type InputPort = InputController

export type CancelReason =
  | 'pointercancel'
  | 'blur'
  | 'escape'
  | 'forced'

export type PointerSessionKind =
  | 'selectionBox'
  | 'edgePath'
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
