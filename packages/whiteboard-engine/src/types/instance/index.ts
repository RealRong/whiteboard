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
import type { Commands } from '../commands'
import type {
  RoutingDragState,
  EdgeReconnectInfo,
  EdgeConnectState,
  HistoryState,
  InteractionState,
  MindmapDragDropTarget,
  MindmapDragState,
  NodeDragState,
  ResizeDirection,
  NodeTransformState,
  NodeOverride,
  SelectionState
} from '../state'
import type { Guide, SnapCandidate } from '../node/snap'
import type { Size } from '../common'
import type { ShortcutContext, Shortcuts } from '../shortcuts'
import type { Lifecycle } from './lifecycle'
import type { RefLike } from '../ui'
import type { MindmapLayoutConfig } from '../mindmap'
import type {
  ContainerRect,
  ContainerSizeObserver,
  EdgeHover,
  GroupAutoFit,
  MindmapDrag,
  NodeTransform,
  NodeSizeObserver,
  ViewportNavigation
} from './services'

export type Store = ReturnType<typeof getDefaultStore>

export type StateSnapshot = {
  interaction: InteractionState
  tool: string
  selection: SelectionState
  edgeSelection: EdgeId | undefined
  history: HistoryState
  edgeConnect: EdgeConnectState
  routingDrag: RoutingDragState
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

export type StateKey = keyof StateSnapshot

export type State = {
  store: Store
  read: <K extends StateKey>(key: K) => StateSnapshot[K]
  write: <K extends StateKey>(
    key: K,
    next:
      | StateSnapshot[K]
      | ((prev: StateSnapshot[K]) => StateSnapshot[K])
  ) => void
  watch: (key: StateKey, listener: () => void) => () => void
  snapshot: () => StateSnapshot
}

export type InstanceConfig = {
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

export type CanvasNodeRect = {
  node: Node
  rect: { x: number; y: number; width: number; height: number }
  aabb: { x: number; y: number; width: number; height: number }
  rotation: number
}

export type EdgeEndpoint = {
  nodeId: NodeId
  anchor: EdgeAnchor
  point: Point
}

export type EdgeEndpoints = {
  source: EdgeEndpoint
  target: EdgeEndpoint
}

export type EdgePath = {
  points: Point[]
  svgPath: string
}

export type EdgePathEntry = {
  id: EdgeId
  edge: Edge
  path: EdgePath
}

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type ViewportTransformView = {
  center: Point
  zoom: number
  transform: string
  cssVars: {
    '--wb-zoom': string
  }
}

export type EdgePreviewView = {
  from?: Point
  to?: Point
  snap?: Point
  reconnect?: EdgeReconnectInfo
  showPreviewLine: boolean
}

export type EdgeSelectedRoutingView = {
  edge: Edge
  points: Point[]
} | undefined

export type MindmapViewTreeLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragView = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

export type MindmapViewTree = {
  id: NodeId
  node: Node
  tree: MindmapTree
  layout: MindmapLayoutConfig
  computed: MindmapLayout
  shiftX: number
  shiftY: number
  lines: MindmapViewTreeLine[]
  labels: Record<MindmapNodeId, string>
}

export type NodeViewItem = {
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

export type NodeTransformHandle = {
  id: string
  kind: 'resize' | 'rotate'
  direction?: ResizeDirection
  position: Point
  cursor: string
}

export type ViewSnapshot = {
  'viewport.transform': ViewportTransformView
  'shortcut.context': ShortcutContext
  'edge.entries': EdgePathEntry[]
  'edge.reconnect': EdgePathEntry | undefined
  'edge.paths': EdgePathEntry[]
  'edge.preview': EdgePreviewView
  'edge.selectedEndpoints': EdgeEndpoints | undefined
  'edge.selectedRouting': EdgeSelectedRoutingView
  'node.items': NodeViewItem[]
  'node.transformHandles': Map<NodeId, NodeTransformHandle[]>
  'mindmap.roots': Node[]
  'mindmap.trees': MindmapViewTree[]
  'mindmap.drag': MindmapDragView | undefined
}

export type ViewKey = keyof ViewSnapshot

export type ViewDebugMetric = {
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

export type ViewDebugSnapshot = {
  [K in ViewKey]: ViewDebugMetric
}

export type ViewDebug = {
  getMetrics: <K extends ViewKey>(key: K) => ViewDebugMetric
  getAllMetrics: () => ViewDebugSnapshot
  resetMetrics: (key?: ViewKey) => void
}

export type View = {
  read: <K extends ViewKey>(key: K) => ViewSnapshot[K]
  watch: (key: ViewKey, listener: () => void) => () => void
  snapshot: () => ViewSnapshot
  debug: ViewDebug
}

export type Query = {
  getNodeRects: () => CanvasNodeRect[]
  getNodeRectById: (nodeId: NodeId) => CanvasNodeRect | undefined
  getNodeIdsInRect: (rect: Rect) => NodeId[]
  getSnapCandidates: () => SnapCandidate[]
  getSnapCandidatesInRect: (rect: Rect) => SnapCandidate[]
  isBackgroundTarget: (target: EventTarget | null) => boolean
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
  getNearestEdgeSegment: (pointWorld: Point, pathPoints: Point[]) => number
}

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

export type Runtime = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  getContainer: () => HTMLDivElement | null
  config: InstanceConfig
  platform: ShortcutContext['platform']
  viewport: ViewportApi
  services: {
    nodeSizeObserver: NodeSizeObserver
    containerSizeObserver: ContainerSizeObserver
    groupAutoFit: GroupAutoFit
    viewportNavigation: ViewportNavigation
    edgeHover: EdgeHover
    nodeTransform: NodeTransform
    mindmapDrag: MindmapDrag
  }
  shortcuts: Shortcuts
  lifecycle: Lifecycle
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

export type Instance = {
  state: State
  runtime: Runtime
  query: Query
  view: View
  commands: Commands
}

export type CreateEngineOptions = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  config?: Partial<InstanceConfig>
}

export type {
  ContainerRect,
  ContainerSizeObserver,
  EdgeHover,
  GroupAutoFit,
  MindmapDrag,
  NodeTransform,
  NodeSizeObserver,
  ViewportNavigation
} from './services'
export type {
  Lifecycle,
  LifecycleConfig,
  LifecycleViewportConfig
} from './lifecycle'
