import type {
  Core,
  Document,
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
  EdgeHover,
  GroupAutoFit,
  MindmapDrag,
  NodeDrag,
  NodeSizeObserver,
  NodeTransform,
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
  edgeHover: EdgeHover
  nodeDrag: NodeDrag
  nodeTransform: NodeTransform
  mindmapDrag: MindmapDrag
}

export type Runtime = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  getContainer: () => HTMLDivElement | null
  config: InstanceConfig
  platform: ShortcutContext['platform']
  viewport: ViewportApi
}

export type RuntimeInternal = Runtime & {
  services: RuntimeServices
  shortcuts: Shortcuts
}
