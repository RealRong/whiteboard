import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { PointerInput, Size } from './common'
import type { Commands } from './commands'
import type { InstanceConfig } from './instance/config'
import type { Query } from './instance/query'
import type { State } from './instance/state'
import type { Shortcuts } from './shortcuts'

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel'
export type PointerStage = 'capture' | 'bubble'
export type PointerTargetRole = 'node' | 'edge' | 'handle' | 'background'
export type PointerHandleType =
  | 'node-connect'
  | 'node-transform'
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
  transformKind?: 'resize' | 'rotate'
  resizeDirection?: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
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
  commands: Commands
  query: Query
  nodeInput: {
    drag: {
      start: (options: {
        nodeId: NodeId
        pointer: PointerInput
        modifiers: Pick<
          PointerInputEvent['modifiers'],
          'alt' | 'shift' | 'ctrl' | 'meta'
        >
      }) => boolean
      update: (pointer: PointerInput) => boolean
      end: (pointer: PointerInput) => boolean
      cancel: (options?: { pointer?: PointerInput }) => boolean
    }
    transform: {
      startResize: (options: {
        nodeId: NodeId
        pointer: PointerInput
        handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
        rect: Rect
        rotation: number
      }) => boolean
      startRotate: (options: {
        nodeId: NodeId
        pointer: PointerInput
        rect: Rect
        rotation: number
      }) => boolean
      update: (pointer: PointerInput, minSize?: Size) => boolean
      end: (pointer: PointerInput) => boolean
      cancel: (options?: { pointer?: PointerInput }) => boolean
    }
  }
  edgeInput: {
    connect: {
      startFromHandle: (
        nodeId: NodeId,
        side: 'top' | 'right' | 'bottom' | 'left',
        pointer: PointerInput
      ) => void
      startReconnect: (
        edgeId: EdgeId,
        end: 'source' | 'target',
        pointer: PointerInput
      ) => void
      handleNodePointerDown: (
        nodeId: NodeId,
        pointer: PointerInput
      ) => boolean
      updateConnect: (pointer: PointerInput) => void
      commitConnect: (pointer: PointerInput) => void
      cancelConnect: () => void
      hoverMove: (pointer: PointerInput | undefined, enabled: boolean) => void
      hoverCancel: () => void
    }
    routing: {
      updateRouting: (pointer: PointerInput) => boolean
      endRouting: (pointer: PointerInput) => boolean
      cancelRouting: () => boolean
      startRouting: (
        edgeId: EdgeId,
        index: number,
        pointer: PointerInput
      ) => boolean
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
  | 'selectionBox'
  | 'edgeConnect'
  | 'edgePath'
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
