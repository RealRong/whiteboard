import type {
  Document,
  NodeId,
  Point,
  Viewport
} from '@whiteboard/core/types'
import type { Size } from '../common'
import type { ResolvedHistoryConfig } from '../common'
import type { Shortcuts } from '../shortcuts'
import type { RefLike } from '../ui'
import type { InstanceConfig } from './config'
import type {
  ContainerRect,
  ContainerSizeObserver,
  GroupAutoFit,
  NodeSizeObserver,
  ViewportNavigation
} from './services'
import type { HistoryState } from '../state'

export type ViewportApi = {
  get: () => Viewport
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  clientToScreen: (clientX: number, clientY: number) => Point
  clientToWorld: (clientX: number, clientY: number) => Point
  getScreenCenter: () => Point
  getContainerSize: () => Size
  setViewport: (viewport: Viewport) => void
  setContainerRect: (rect: ContainerRect) => void
}

export type RuntimeServices = {
  nodeSizeObserver: NodeSizeObserver
  containerSizeObserver: ContainerSizeObserver
  groupAutoFit: GroupAutoFit
  viewportNavigation: ViewportNavigation
}

export type RuntimeDom = {
  nodeSize: {
    observe: (nodeId: NodeId, element: Element, enabled?: boolean) => void
    unobserve: (nodeId: NodeId) => void
  }
}

export type RuntimeDocument = {
  get: () => Document
  replace: (doc: Document, options?: { silent?: boolean }) => void
}

export type RuntimeHistory = {
  configure: (config: Partial<ResolvedHistoryConfig>) => void
  undo: () => boolean
  redo: () => boolean
  clear: () => void
  getState: () => HistoryState
  subscribe: (listener: (state: HistoryState) => void) => () => void
}

export type Runtime = {
  document: RuntimeDocument
  history: RuntimeHistory
  containerRef: RefLike<HTMLDivElement | null>
  getContainer: () => HTMLDivElement | null
  config: InstanceConfig
  viewport: ViewportApi
  dom: RuntimeDom
}

export type RuntimeInternal = Runtime & {
  services: RuntimeServices
  shortcuts: Shortcuts
}
