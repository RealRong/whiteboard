import { getDefaultStore } from 'jotai'
import type { Atom } from 'jotai/vanilla'
import type { Core, Document, Edge, EdgeAnchor, EdgeId, Node, NodeId, Point, Rect, Viewport } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { WhiteboardCommands } from '../commands'
import type {
  EdgeConnectState,
  InteractionState,
  NodeOverride,
  SelectionState
} from '../state'
import type { Guide } from '../node/snap'
import type { Size } from '../common'
import type { ShortcutManager } from '../shortcuts'
import type { ContainerSizeObserverService, NodeSizeObserverService } from './services'

export type Store = ReturnType<typeof getDefaultStore>

export type WhiteboardStateNamespace = {
  store: Store
  atoms: {
    interaction: Atom<InteractionState>
    tool: Atom<string>
    selection: Atom<SelectionState>
    edgeSelection: Atom<EdgeId | undefined>
    edgeConnect: Atom<EdgeConnectState>
    spacePressed: Atom<boolean>
    dragGuides: Atom<Guide[]>
    groupHovered: Atom<NodeId | undefined>
    nodeOverrides: Atom<Map<NodeId, NodeOverride>>
    canvasNodes: Atom<Node[]>
    visibleEdges: Atom<Edge[]>
  }
  get: Store['get']
  set: Store['set']
  sub: Store['sub']
}

export type WhiteboardInstanceConfig = {
  nodeSize: Size
  mindmapNodeSize: Size
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

export type WhiteboardInstanceQuery = {
  getCanvasNodeRects: () => WhiteboardCanvasNodeRect[]
  getCanvasNodeRectById: (nodeId: NodeId) => WhiteboardCanvasNodeRect | undefined
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => WhiteboardEdgeConnectAnchorResult
  getEdgeConnectFromPoint: (from?: EdgeConnectState['from']) => Point | undefined
  getEdgeConnectToPoint: (to?: EdgeConnectState['to']) => Point | undefined
  getEdgeResolvedEndpoints: (edge: Edge) => WhiteboardEdgeResolvedEndpoints | undefined
  getEdgePathEntry: (edge: Edge) => WhiteboardEdgePathEntry | undefined
}

export type WhiteboardViewportRuntimeState = {
  viewport: Viewport
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  screenCenter: Point
  containerSize: Size
}

export type WhiteboardViewportRuntime = {
  get: () => Viewport
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  getScreenCenter: () => Point
  getContainerSize: () => Size
  set: (next: WhiteboardViewportRuntimeState) => void
}

export type WhiteboardRuntimeNamespace = {
  core: Core
  docRef: RefObject<Document>
  containerRef: RefObject<HTMLDivElement | null>
  getContainer: () => HTMLDivElement | null
  config: WhiteboardInstanceConfig
  viewport: WhiteboardViewportRuntime
  services: {
    nodeSizeObserver: NodeSizeObserverService
    containerSizeObserver: ContainerSizeObserverService
  }
  shortcuts: ShortcutManager
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
  docRef: RefObject<Document>
  containerRef: RefObject<HTMLDivElement | null>
  config?: Partial<WhiteboardInstanceConfig>
}

export type { ContainerSizeObserverService, NodeSizeObserverService } from './services'
