import type {
  Core,
  Document,
  EdgeAnchor,
  EdgeId,
  NodeId,
  Point,
  Viewport
} from '@whiteboard/core'
import type { Size } from '../common'
import type {
  MindmapCancelDragOptions,
  MindmapEndDragOptions,
  MindmapStartDragOptions,
  MindmapUpdateDragOptions,
  NodeDragCancelOptions,
  NodeDragEndOptions,
  NodeDragStartOptions,
  NodeDragUpdateOptions,
  NodeResizeStartOptions,
  NodeRotateStartOptions,
  NodeTransformCancelOptions,
  NodeTransformEndOptions,
  NodeTransformUpdateOptions,
  RoutingDragCancelOptions,
  RoutingDragEndOptions,
  RoutingDragStartOptions,
  RoutingDragUpdateOptions
} from '../commands'
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

export type RuntimeInteraction = {
  edgeConnect: {
    startFromHandle: (nodeId: NodeId, side: EdgeAnchor['side'], pointerId?: number) => void
    startFromPoint: (nodeId: NodeId, pointWorld: Point, pointerId?: number) => void
    startReconnect: (edgeId: EdgeId, end: 'source' | 'target', pointerId?: number) => void
    updateTo: (pointWorld: Point) => void
    commitTo: (pointWorld: Point) => void
    cancel: () => void
    updateHover: (pointWorld: Point) => void
    hoverMove: (clientX: number, clientY: number, enabled: boolean) => void
    hoverCancel: () => void
    handleNodePointerDown: (nodeId: NodeId, pointWorld: Point, pointerId?: number) => boolean
  }
  routingDrag: {
    start: (options: RoutingDragStartOptions) => boolean
    update: (options: RoutingDragUpdateOptions) => boolean
    end: (options: RoutingDragEndOptions) => boolean
    cancel: (options?: RoutingDragCancelOptions) => boolean
  }
  nodeDrag: {
    start: (options: NodeDragStartOptions) => boolean
    update: (options: NodeDragUpdateOptions) => boolean
    end: (options: NodeDragEndOptions) => boolean
    cancel: (options?: NodeDragCancelOptions) => boolean
  }
  mindmapDrag: {
    start: (options: MindmapStartDragOptions) => boolean
    update: (options: MindmapUpdateDragOptions) => boolean
    end: (options: MindmapEndDragOptions) => boolean
    cancel: (options?: MindmapCancelDragOptions) => boolean
  }
  nodeTransform: {
    startResize: (options: NodeResizeStartOptions) => boolean
    startRotate: (options: NodeRotateStartOptions) => boolean
    update: (options: NodeTransformUpdateOptions) => boolean
    end: (options: NodeTransformEndOptions) => boolean
    cancel: (options?: NodeTransformCancelOptions) => boolean
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
  interaction: RuntimeInteraction
}

export type RuntimeInternal = Runtime & {
  services: RuntimeServices
  shortcuts: Shortcuts
}
