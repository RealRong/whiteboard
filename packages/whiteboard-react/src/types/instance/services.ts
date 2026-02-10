import type { NodeId, Size as CoreSize } from '@whiteboard/core'

export type NodeSizeObserverService = {
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

export type ContainerSizeObserverService = {
  observe: (element: Element, onRect: (rect: ContainerRect) => void) => void
  unobserve: (element?: Element) => void
  dispose: () => void
}

export type PendingNodeSizeUpdate = {
  id: NodeId
  size: CoreSize
}
