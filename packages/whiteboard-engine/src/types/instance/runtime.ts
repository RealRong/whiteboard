import type {
  Core,
  Document,
  NodeId,
  Point,
  Viewport
} from '@whiteboard/core'
import type { Size } from '../common'
import type { ShortcutContext, Shortcuts } from '../shortcuts'
import type { RefLike } from '../ui'
import type { InstanceConfig } from './config'
import type {
  ContainerRect,
  ContainerSizeObserver,
  GroupAutoFit,
  NodeSizeObserver,
  ViewportNavigation
} from './services'

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

export type Runtime = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  getContainer: () => HTMLDivElement | null
  config: InstanceConfig
  platform: ShortcutContext['platform']
  viewport: ViewportApi
  dom: RuntimeDom
}

export type RuntimeInternal = Runtime & {
  services: RuntimeServices
  shortcuts: Shortcuts
}
