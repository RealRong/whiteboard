import { getDefaultStore } from 'jotai'
import type { Core, Document, Edge, EdgeAnchor, EdgeId, Node, NodeId, Point, Rect, Viewport } from '@whiteboard/core'
import type { WhiteboardCommands } from '../commands'
import type {
  EdgeConnectState,
  HistoryState,
  InteractionState,
  NodeOverride,
  SelectionState
} from '../state'
import type { Guide, SnapCandidate } from '../node/snap'
import type { Size } from '../common'
import type { ShortcutContext, ShortcutNativeEvent, ShortcutRuntime } from '../shortcuts'
import type { WhiteboardLifecycleRuntime } from './lifecycle'
import type { RefLike } from '../ui'
import type {
  ContainerRect,
  ContainerSizeObserverService,
  EdgeHoverService,
  GroupAutoFitService,
  MindmapDragService,
  NodeTransformService,
  NodeSizeObserverService,
  ViewportNavigationService
} from './services'

export type Store = ReturnType<typeof getDefaultStore>

export type WhiteboardStateSnapshot = {
  interaction: InteractionState
  tool: string
  selection: SelectionState
  edgeSelection: EdgeId | undefined
  history: HistoryState
  edgeConnect: EdgeConnectState
  viewport: Viewport
  spacePressed: boolean
  dragGuides: Guide[]
  groupHovered: NodeId | undefined
  nodeOverrides: Map<NodeId, NodeOverride>
  canvasNodes: Node[]
  visibleEdges: Edge[]
}

export type WhiteboardStateKey = keyof WhiteboardStateSnapshot

export type WhiteboardStateNamespace = {
  store: Store
  read: <K extends WhiteboardStateKey>(key: K) => WhiteboardStateSnapshot[K]
  write: <K extends WhiteboardStateKey>(
    key: K,
    next:
      | WhiteboardStateSnapshot[K]
      | ((prev: WhiteboardStateSnapshot[K]) => WhiteboardStateSnapshot[K])
  ) => void
  watch: (key: WhiteboardStateKey, listener: () => void) => () => void
  snapshot: () => WhiteboardStateSnapshot
}

export type WhiteboardInstanceConfig = {
  nodeSize: Size
  mindmapNodeSize: Size
  node: {
    groupPadding: number
    snapThresholdScreen: number
    snapMaxThresholdWorld: number
    snapGridCellSize: number
    selectionMinDragDistance: number
  }
  edge: {
    hitTestThresholdScreen: number
    anchorSnapMin: number
    anchorSnapRatio: number
  }
  viewport: {
    wheelSensitivity: number
  }
}

export type WhiteboardCanvasNodeRect = {
  node: Node
  rect: { x: number; y: number; width: number; height: number }
  aabb: { x: number; y: number; width: number; height: number }
  rotation: number
}

export type WhiteboardEdgeEndpoint = {
  nodeId: NodeId
  anchor: EdgeAnchor
  point: Point
}

export type WhiteboardEdgeResolvedEndpoints = {
  source: WhiteboardEdgeEndpoint
  target: WhiteboardEdgeEndpoint
}

export type WhiteboardEdgePath = {
  points: Point[]
  svgPath: string
}

export type WhiteboardEdgePathEntry = {
  id: EdgeId
  edge: Edge
  path: WhiteboardEdgePath
}

export type WhiteboardEdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type WhiteboardContainerRect = ContainerRect

export type WhiteboardInstanceQuery = {
  getCanvasNodeRects: () => WhiteboardCanvasNodeRect[]
  getCanvasNodeRectById: (nodeId: NodeId) => WhiteboardCanvasNodeRect | undefined
  getNodeIdsInRect: (rect: Rect) => NodeId[]
  getSnapCandidates: () => SnapCandidate[]
  getSnapCandidatesInRect: (rect: Rect) => SnapCandidate[]
  isCanvasBackgroundTarget: (target: EventTarget | null) => boolean
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => WhiteboardEdgeConnectAnchorResult
  getEdgeConnectFromPoint: (from?: EdgeConnectState['from']) => Point | undefined
  getEdgeConnectToPoint: (to?: EdgeConnectState['to']) => Point | undefined
  getEdgeResolvedEndpoints: (edge: Edge) => WhiteboardEdgeResolvedEndpoints | undefined
  getEdgePathEntry: (edge: Edge) => WhiteboardEdgePathEntry | undefined
  getNearestEdgeSegmentIndexAtWorld: (pointWorld: Point, pathPoints: Point[]) => number
  getShortcutContext: (event?: ShortcutNativeEvent) => ShortcutContext
}

export type WhiteboardViewportRuntime = {
  get: () => Viewport
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  clientToScreen: (clientX: number, clientY: number) => Point
  clientToWorld: (clientX: number, clientY: number) => Point
  getScreenCenter: () => Point
  getContainerSize: () => Size
  setViewport: (viewport: Viewport) => void
  setContainerRect: (rect: WhiteboardContainerRect) => void
}

export type WhiteboardRuntimeNamespace = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  getContainer: () => HTMLDivElement | null
  config: WhiteboardInstanceConfig
  platform: ShortcutContext['platform']
  viewport: WhiteboardViewportRuntime
  services: {
    nodeSizeObserver: NodeSizeObserverService
    containerSizeObserver: ContainerSizeObserverService
    groupAutoFit: GroupAutoFitService
    viewportNavigation: ViewportNavigationService
    edgeHover: EdgeHoverService
    nodeTransform: NodeTransformService
    mindmapDrag: MindmapDragService
  }
  shortcuts: ShortcutRuntime
  lifecycle: WhiteboardLifecycleRuntime
  events: {
    onWindow: <K extends keyof WindowEventMap>(
      type: K,
      listener: (event: WindowEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ) => () => void
    onContainer: <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ) => () => void
  }
}

export type WhiteboardInstance = {
  state: WhiteboardStateNamespace
  runtime: WhiteboardRuntimeNamespace
  query: WhiteboardInstanceQuery
  commands: WhiteboardCommands
}

export type CreateWhiteboardInstanceOptions = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  config?: Partial<WhiteboardInstanceConfig>
}

export type {
  ContainerRect,
  ContainerSizeObserverService,
  EdgeHoverService,
  GroupAutoFitService,
  MindmapDragService,
  NodeTransformService,
  NodeSizeObserverService,
  ViewportNavigationService
} from './services'
export type {
  WhiteboardLifecycleConfig,
  WhiteboardLifecycleRuntime,
  WhiteboardLifecycleViewportConfig
} from './lifecycle'
