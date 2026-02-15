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
import type { MindmapLayoutConfig } from '../mindmap'
import type { Size, WhiteboardResolvedHistoryConfig } from '../common'
import type { Guide } from '../node/snap'
import type { NodeDragGroupOptions } from '../node/drag'
import type { InteractionState, NodeViewUpdate, SelectionMode } from '../state'
import type { NodeTransformResizeDirection } from '../state'

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

export type MindmapMoveSubtreeWithLayoutOptions = {
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

export type MindmapMoveSubtreeWithDropOptions = {
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

export type EdgeRoutingPointDragStartOptions = {
  edgeId: EdgeId
  index: number
  pointerId: number
  clientX: number
  clientY: number
}

export type EdgeRoutingPointDragUpdateOptions = {
  pointerId: number
  clientX: number
  clientY: number
}

export type EdgeRoutingPointDragEndOptions = {
  pointerId: number
}

export type EdgeRoutingPointDragCancelOptions = {
  pointerId?: number
}

export type NodeTransformStartResizeOptions = {
  nodeId: NodeId
  pointerId: number
  handle: NodeTransformResizeDirection
  clientX: number
  clientY: number
  rect: Rect
  rotation: number
}

export type NodeTransformStartRotateOptions = {
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

export type WhiteboardMindmapCommands = Core['commands']['mindmap'] & {
  insertNode: (options: MindmapInsertNodeOptions) => Promise<void>
  moveSubtreeWithLayout: (options: MindmapMoveSubtreeWithLayoutOptions) => Promise<DispatchResult>
  moveSubtreeWithDrop: (options: MindmapMoveSubtreeWithDropOptions) => Promise<void>
  moveRoot: (options: MindmapMoveRootOptions) => Promise<void>
  startDrag: (options: MindmapStartDragOptions) => boolean
  updateDrag: (options: MindmapUpdateDragOptions) => boolean
  endDrag: (options: MindmapEndDragOptions) => boolean
  cancelDrag: (options?: MindmapCancelDragOptions) => boolean
}

export type WhiteboardCommands = {
  tool: {
    set: (tool: string) => void
  }
  keyboard: {
    setSpacePressed: (pressed: boolean) => void
  }
  history: {
    configure: (config: WhiteboardResolvedHistoryConfig) => void
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
    insertRoutingPointAtClient: (edge: Edge, pathPoints: Point[], clientX: number, clientY: number) => void
    moveRoutingPoint: (edge: Edge, index: number, pointWorld: Point) => void
    removeRoutingPoint: (edge: Edge, index: number) => void
    startRoutingPointDrag: (options: EdgeRoutingPointDragStartOptions) => boolean
    updateRoutingPointDrag: (options: EdgeRoutingPointDragUpdateOptions) => boolean
    endRoutingPointDrag: (options: EdgeRoutingPointDragEndOptions) => boolean
    cancelRoutingPointDrag: (options?: EdgeRoutingPointDragCancelOptions) => boolean
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
    updateToClient: (clientX: number, clientY: number) => void
    commitTo: (pointWorld: Point) => void
    commitToClient: (clientX: number, clientY: number) => void
    cancel: () => void
    updateHover: (pointWorld: Point) => void
    updateHoverAtClient: (clientX: number, clientY: number) => void
    handleNodePointerDown: (nodeId: NodeId, pointWorld: Point, pointerId?: number) => boolean
  }
  groupRuntime: {
    setHoveredGroupId: (groupId?: NodeId) => void
  }
  nodeDrag: {
    start: (options: NodeDragStartOptions) => boolean
    update: (options: NodeDragUpdateOptions) => boolean
    end: (options: NodeDragEndOptions) => boolean
    cancel: (options?: NodeDragCancelOptions) => boolean
    getGroupContext: () => NodeDragGroupOptions
    updateHoverGroup: (current: NodeId | undefined, next?: NodeId) => NodeId | undefined
    clearHoverGroup: (current?: NodeId) => NodeId | undefined
    resolveMove: (payload: {
      nodeId: NodeId
      position: Point
      size: { width: number; height: number }
      childrenIds?: NodeId[]
      allowCross?: boolean
    }) => Point
    clearGuides: () => void
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
  }
  nodeTransform: {
    rotate: (nodeId: NodeId, angle: number) => Promise<DispatchResult>
    previewResize: (nodeId: NodeId, update: { position: Point; size: Size }) => void
    commitResize: (nodeId: NodeId, update?: { position: Point; size: Size }) => void
    setGuides: (guides: Guide[]) => void
    clearGuides: () => void
    startResize: (options: NodeTransformStartResizeOptions) => boolean
    startRotate: (options: NodeTransformStartRotateOptions) => boolean
    update: (options: NodeTransformUpdateOptions) => boolean
    end: (options: NodeTransformEndOptions) => boolean
    cancel: (options?: NodeTransformCancelOptions) => boolean
  }
  group: Core['commands']['group']
  mindmap: WhiteboardMindmapCommands
}
