import type { NodeId, Size as CoreSize } from '@whiteboard/core'

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
    pointerId: number
    button: number
    clientX: number
    clientY: number
    spacePressed: boolean
    enablePan: boolean
  }) => boolean
  updatePan: (options: {
    pointerId: number
    clientX: number
    clientY: number
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
