import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { PointerInput } from '../common/input'

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
