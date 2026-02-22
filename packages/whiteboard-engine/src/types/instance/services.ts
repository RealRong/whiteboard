import type { NodeId, Size as CoreSize } from '@whiteboard/core/types'
import type { PointerInput } from '../common'

export type NodeSizeObserver = {
  observe: (nodeId: NodeId, element: Element, enabled?: boolean) => void
  unobserve: (nodeId: NodeId) => void
  dispose: () => void
}

export type ContainerRect = {
  left: number
  top: number
  width: number
  height: number
}

export type ContainerSizeObserver = {
  observe: (element: Element, onRect: (rect: ContainerRect) => void) => void
  unobserve: (element?: Element) => void
  dispose: () => void
}

export type GroupAutoFit = {
  start: () => () => void
  stop: () => void
  sync: () => void
  reset: () => void
  dispose: () => void
}

export type ViewportNavigation = {
  startPan: (options: {
    pointer: PointerInput
    enablePan: boolean
  }) => boolean
  updatePan: (options: {
    pointer: PointerInput
  }) => void
  endPan: (options: {
    pointerId: number
  }) => boolean
  applyWheelZoom: (options: {
    clientX: number
    clientY: number
    deltaY: number
    enableWheel: boolean
    minZoom: number
    maxZoom: number
    wheelSensitivity: number
  }) => boolean
  dispose: () => void
}

export type PendingNodeSizeUpdate = {
  id: NodeId
  size: CoreSize
}
