import type {
  Core,
  DispatchResult,
  Edge,
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  EdgePatch,
  MindmapAttachPayload,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core'
import type { MindmapLayoutConfig } from './mindmap'
import type { Size, ResolvedHistoryConfig } from './common'
import type { Guide } from './node/snap'
import type { InteractionState, NodeViewUpdate, SelectionMode } from './state'
import type { ResizeDirection } from './state'
import type {
  RoutingDragStartOptions,
  RoutingDragUpdateOptions,
  RoutingDragEndOptions,
  RoutingDragCancelOptions
} from './edge/routing'

export type MindmapInsertPlacement = 'left' | 'right' | 'up' | 'down'

export type MindmapInsertNodeOptions = {
  id: MindmapId
  tree: MindmapTree
  targetNodeId: MindmapNodeId
  placement: MindmapInsertPlacement
  nodeSize: Size
  layout: MindmapLayoutConfig
  payload?: MindmapNodeData | MindmapAttachPayload
}

export type MindmapMoveLayoutOptions = {
  id: MindmapId
  nodeId: MindmapNodeId
  newParentId: MindmapNodeId
  index?: number
  side?: 'left' | 'right'
  nodeSize: Size
  layout: MindmapLayoutConfig
}

export type MindmapMoveRootOptions = {
  nodeId: NodeId
  position: Point
  threshold?: number
}

export type MindmapMoveDropOptions = {
  id: MindmapId
  nodeId: MindmapNodeId
  drop: {
    parentId: MindmapNodeId
    index: number
    side?: 'left' | 'right'
  }
  origin?: {
    parentId?: MindmapNodeId
    index?: number
  }
  nodeSize: Size
  layout: MindmapLayoutConfig
}

export type MindmapStartDragOptions = {
  treeId: MindmapId
  nodeId: MindmapNodeId
  pointerId: number
  clientX: number
  clientY: number
}

export type MindmapUpdateDragOptions = {
  pointerId: number
  clientX: number
  clientY: number
}

export type MindmapEndDragOptions = {
  pointerId: number
}

export type MindmapCancelDragOptions = {
  pointerId?: number
}

export type NodeDragStartOptions = {
  nodeId: NodeId
  pointerId: number
  clientX: number
  clientY: number
}

export type NodeDragUpdateOptions = {
  pointerId: number
  clientX: number
  clientY: number
  altKey?: boolean
}

export type NodeDragEndOptions = {
  pointerId: number
}

export type NodeDragCancelOptions = {
  pointerId?: number
}

export type {
  RoutingDragStartOptions,
  RoutingDragUpdateOptions,
  RoutingDragEndOptions,
  RoutingDragCancelOptions
} from './edge/routing'

export type NodeResizeStartOptions = {
  nodeId: NodeId
  pointerId: number
  handle: ResizeDirection
  clientX: number
  clientY: number
  rect: Rect
  rotation: number
}

export type NodeRotateStartOptions = {
  nodeId: NodeId
  pointerId: number
  clientX: number
  clientY: number
  rect: Rect
  rotation: number
}

export type NodeTransformUpdateOptions = {
  pointerId: number
  clientX: number
  clientY: number
  minSize: Size
  altKey?: boolean
  shiftKey?: boolean
}

export type NodeTransformEndOptions = {
  pointerId: number
}

export type NodeTransformCancelOptions = {
  pointerId?: number
}

export type MindmapCommands = Core['commands']['mindmap'] & {
  insertNode: (options: MindmapInsertNodeOptions) => Promise<void>
  moveSubtreeWithLayout: (options: MindmapMoveLayoutOptions) => Promise<DispatchResult>
  moveSubtreeWithDrop: (options: MindmapMoveDropOptions) => Promise<void>
  moveRoot: (options: MindmapMoveRootOptions) => Promise<void>
  startDrag: (options: MindmapStartDragOptions) => boolean
  updateDrag: (options: MindmapUpdateDragOptions) => boolean
  endDrag: (options: MindmapEndDragOptions) => boolean
  cancelDrag: (options?: MindmapCancelDragOptions) => boolean
}

export type Commands = {
  tool: {
    set: (tool: 'select' | 'edge') => void
  }
  keyboard: {
    setSpacePressed: (pressed: boolean) => void
  }
  history: {
    configure: (config: ResolvedHistoryConfig) => void
    undo: () => boolean
    redo: () => boolean
    clear: () => void
  }
  interaction: {
    update: (patch: Partial<InteractionState>) => void
    clearHover: () => void
  }
  selection: {
    select: (ids: NodeId[], mode?: SelectionMode) => void
    toggle: (ids: NodeId[]) => void
    clear: () => void
    getSelectedNodeIds: () => NodeId[]
    beginBox: (mode?: SelectionMode) => void
    updateBox: (selectionRect: Rect, selectionRectWorld?: Rect) => void
    endBox: () => void
  }
  edge: {
    create: (payload: EdgeInput) => Promise<DispatchResult>
    update: (id: EdgeId, patch: EdgePatch) => Promise<DispatchResult>
    delete: (ids: EdgeId[]) => Promise<DispatchResult>
    insertRoutingPoint: (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => void
    moveRoutingPoint: (edge: Edge, index: number, pointWorld: Point) => void
    removeRoutingPoint: (edge: Edge, index: number) => void
    startRoutingDrag: (options: RoutingDragStartOptions) => boolean
    updateRoutingDrag: (options: RoutingDragUpdateOptions) => boolean
    endRoutingDrag: (options: RoutingDragEndOptions) => boolean
    cancelRoutingDrag: (options?: RoutingDragCancelOptions) => boolean
    resetRouting: (edge: Edge) => void
    connect: (
      source: { nodeId: NodeId; anchor?: EdgeAnchor },
      target: { nodeId: NodeId; anchor?: EdgeAnchor }
    ) => Promise<DispatchResult>
    reconnect: (
      id: EdgeId,
      end: 'source' | 'target',
      ref: { nodeId: NodeId; anchor?: EdgeAnchor }
    ) => Promise<DispatchResult>
    select: (id?: EdgeId) => void
  }
  edgeConnect: {
    startFromHandle: (nodeId: NodeId, side: EdgeAnchor['side'], pointerId?: number) => void
    startFromPoint: (nodeId: NodeId, pointWorld: Point, pointerId?: number) => void
    startReconnect: (edgeId: EdgeId, end: 'source' | 'target', pointerId?: number) => void
    updateTo: (pointWorld: Point) => void
    commitTo: (pointWorld: Point) => void
    cancel: () => void
    updateHover: (pointWorld: Point) => void
    handleNodePointerDown: (nodeId: NodeId, pointWorld: Point, pointerId?: number) => boolean
  }
  nodeDrag: {
    start: (options: NodeDragStartOptions) => boolean
    update: (options: NodeDragUpdateOptions) => boolean
    end: (options: NodeDragEndOptions) => boolean
    cancel: (options?: NodeDragCancelOptions) => boolean
  }
  transient: {
    dragGuides: {
      set: (guides: Guide[]) => void
      clear: () => void
    }
    nodeOverrides: {
      set: (updates: NodeViewUpdate[]) => void
      clear: (ids?: NodeId[]) => void
      commit: (updates?: NodeViewUpdate[]) => void
    }
    reset: () => void
  }
  order: {
    node: {
      set: (ids: NodeId[]) => Promise<DispatchResult>
      bringToFront: (ids: NodeId[]) => Promise<DispatchResult>
      sendToBack: (ids: NodeId[]) => Promise<DispatchResult>
      bringForward: (ids: NodeId[]) => Promise<DispatchResult>
      sendBackward: (ids: NodeId[]) => Promise<DispatchResult>
    }
    edge: {
      set: (ids: EdgeId[]) => Promise<DispatchResult>
      bringToFront: (ids: EdgeId[]) => Promise<DispatchResult>
      sendToBack: (ids: EdgeId[]) => Promise<DispatchResult>
      bringForward: (ids: EdgeId[]) => Promise<DispatchResult>
      sendBackward: (ids: EdgeId[]) => Promise<DispatchResult>
    }
  }
  viewport: {
    set: (viewport: Viewport) => Promise<DispatchResult>
    panBy: (delta: { x: number; y: number }) => Promise<DispatchResult>
    zoomBy: (factor: number, anchor?: Point) => Promise<DispatchResult>
    zoomTo: (zoom: number, anchor?: Point) => Promise<DispatchResult>
    reset: () => Promise<DispatchResult>
  }
  node: {
    create: (payload: NodeInput) => Promise<DispatchResult>
    update: (id: NodeId, patch: NodePatch) => Promise<DispatchResult>
    updateData: (id: NodeId, patch: Record<string, unknown>) => Promise<DispatchResult> | undefined
    updateManyPosition: (updates: Array<{ id: NodeId; position: Point }>) => void
    delete: (ids: NodeId[]) => Promise<DispatchResult>
    move: (ids: NodeId[], delta: { x: number; y: number }) => Promise<DispatchResult>
    resize: (id: NodeId, size: { width: number; height: number }) => Promise<DispatchResult>
    rotate: (id: NodeId, angle: number) => Promise<DispatchResult>
    observeSize: (nodeId: NodeId, element: Element, enabled?: boolean) => void
    unobserveSize: (nodeId: NodeId) => void
  }
  nodeTransform: {
    rotate: (nodeId: NodeId, angle: number) => Promise<DispatchResult>
    previewResize: (nodeId: NodeId, update: { position: Point; size: Size }) => void
    commitResize: (nodeId: NodeId, update?: { position: Point; size: Size }) => void
    setGuides: (guides: Guide[]) => void
    clearGuides: () => void
    startResize: (options: NodeResizeStartOptions) => boolean
    startRotate: (options: NodeRotateStartOptions) => boolean
    update: (options: NodeTransformUpdateOptions) => boolean
    end: (options: NodeTransformEndOptions) => boolean
    cancel: (options?: NodeTransformCancelOptions) => boolean
  }
  group: Core['commands']['group']
  mindmap: MindmapCommands
}
