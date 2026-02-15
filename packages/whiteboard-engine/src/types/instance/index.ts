import { getDefaultStore } from 'jotai'
import type {
  Core,
  Document,
  Edge,
  EdgeAnchor,
  EdgeId,
  MindmapLayout,
  MindmapNodeId,
  MindmapTree,
  Node,
  NodeId,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core'
import type { WhiteboardCommands } from '../commands'
import type {
  EdgeRoutingPointDragState,
  EdgeReconnectInfo,
  EdgeConnectState,
  HistoryState,
  InteractionState,
  MindmapDragDropTarget,
  MindmapDragState,
  NodeDragState,
  NodeTransformResizeDirection,
  NodeTransformState,
  NodeOverride,
  SelectionState
} from '../state'
import type { Guide, SnapCandidate } from '../node/snap'
import type { Size } from '../common'
import type { ShortcutContext, ShortcutNativeEvent, ShortcutRuntime } from '../shortcuts'
import type { WhiteboardLifecycleRuntime } from './lifecycle'
import type { RefLike } from '../ui'
import type { MindmapLayoutConfig } from '../mindmap'
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
  edgeRoutingPointDrag: EdgeRoutingPointDragState
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
  mindmapDrag: MindmapDragState
  nodeDrag: NodeDragState
  nodeTransform: NodeTransformState
  spacePressed: boolean
  dragGuides: Guide[]
  groupHovered: NodeId | undefined
  nodeOverrides: Map<NodeId, NodeOverride>
  visibleNodes: Node[]
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

export type WhiteboardEdgeConnectPreview = {
  from?: Point
  to?: Point
  hover?: Point
  reconnect?: EdgeReconnectInfo
  showPreviewLine: boolean
}

export type WhiteboardViewportTransformView = {
  center: Point
  zoom: number
  transform: string
  cssVars: {
    '--wb-zoom': string
  }
}

export type WhiteboardEdgePreviewView = {
  from?: Point
  to?: Point
  snap?: Point
  reconnect?: EdgeReconnectInfo
  showPreviewLine: boolean
}

export type WhiteboardEdgeSelectedRoutingView = {
  edge: Edge
  points: Point[]
} | undefined

export type WhiteboardMindmapViewTreeLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type WhiteboardMindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type WhiteboardMindmapDragView = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: WhiteboardMindmapDragPreview
}

export type WhiteboardMindmapViewTree = {
  id: NodeId
  node: Node
  tree: MindmapTree
  layout: MindmapLayoutConfig
  computed: MindmapLayout
  shiftX: number
  shiftY: number
  lines: WhiteboardMindmapViewTreeLine[]
  labels: Record<MindmapNodeId, string>
}

export type WhiteboardNodeViewItem = {
  node: Node
  rect: Rect
  container: {
    transformBase: string
    rotation: number
    transformOrigin: 'center center'
  }
  selected: boolean
  hovered: boolean
  activeTool: 'select' | 'edge'
  zoom: number
}

export type WhiteboardNodeTransformHandle = {
  id: string
  kind: 'resize' | 'rotate'
  direction?: NodeTransformResizeDirection
  position: Point
  cursor: string
}

export type WhiteboardViewSnapshot = {
  'viewport.transform': WhiteboardViewportTransformView
  'edge.entries': WhiteboardEdgePathEntry[]
  'edge.reconnect': WhiteboardEdgePathEntry | undefined
  'edge.paths': WhiteboardEdgePathEntry[]
  'edge.preview': WhiteboardEdgePreviewView
  'edge.selectedEndpoints': WhiteboardEdgeResolvedEndpoints | undefined
  'edge.selectedRouting': WhiteboardEdgeSelectedRoutingView
  'node.items': WhiteboardNodeViewItem[]
  'node.transformHandles': Map<NodeId, WhiteboardNodeTransformHandle[]>
  'mindmap.roots': Node[]
  'mindmap.trees': WhiteboardMindmapViewTree[]
  'mindmap.drag': WhiteboardMindmapDragView | undefined
}

export type WhiteboardViewKey = keyof WhiteboardViewSnapshot

export type WhiteboardViewDebugMetric = {
  revision: number
  dirty: boolean
  recomputeCount: number
  cacheHitCount: number
  cacheMissCount: number
  cacheHitRate: number
  lastComputeMs: number
  avgComputeMs: number
  maxComputeMs: number
  totalComputeMs: number
  lastComputedAt?: number
}

export type WhiteboardViewDebugSnapshot = {
  [K in WhiteboardViewKey]: WhiteboardViewDebugMetric
}

export type WhiteboardViewDebugNamespace = {
  getMetrics: <K extends WhiteboardViewKey>(key: K) => WhiteboardViewDebugMetric
  getAllMetrics: () => WhiteboardViewDebugSnapshot
  resetMetrics: (key?: WhiteboardViewKey) => void
}

export type WhiteboardViewNamespace = {
  read: <K extends WhiteboardViewKey>(key: K) => WhiteboardViewSnapshot[K]
  watch: (key: WhiteboardViewKey, listener: () => void) => () => void
  snapshot: () => WhiteboardViewSnapshot
  debug: WhiteboardViewDebugNamespace
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
  getEdgeConnectPreview: (state: EdgeConnectState) => WhiteboardEdgeConnectPreview
  getEdgePathEntries: () => WhiteboardEdgePathEntry[]
  getEdgeReconnectPathEntry: (state: EdgeConnectState) => WhiteboardEdgePathEntry | undefined
  getEdgeResolvedEndpoints: (edge: Edge) => WhiteboardEdgeResolvedEndpoints | undefined
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
  view: WhiteboardViewNamespace
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
