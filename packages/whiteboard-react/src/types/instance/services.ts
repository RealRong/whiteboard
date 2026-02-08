import type { NodeId, Size as CoreSize } from '@whiteboard/core'
import type { Size } from '../common'

export type NodeSizeObserverService = {
  observe: (nodeId: NodeId, element: Element, enabled?: boolean) => void
  unobserve: (nodeId: NodeId) => void
  dispose: () => void
}

export type ContainerSizeObserverService = {
  observe: (element: Element, onSize: (size: Size) => void) => void
  unobserve: (element?: Element) => void
  dispose: () => void
}

export type PendingNodeSizeUpdate = {
  id: NodeId
  size: CoreSize
}
