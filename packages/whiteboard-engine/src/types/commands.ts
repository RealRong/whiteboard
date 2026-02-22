import type {
  Document,
  DispatchResult,
  Edge,
  EdgeId,
  EdgeInput,
  EdgePatch,
  MindmapAttachPayload,
  MindmapId,
  MindmapIntentOptions,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from './mindmap'
import type {
  PointerInput,
  Size,
  ResolvedHistoryConfig
} from './common'
import type { InteractionState, SelectionMode } from './state'
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
  pointer: PointerInput
}

export type MindmapUpdateDragOptions = {
  pointer: PointerInput
}

export type MindmapEndDragOptions = {
  pointer: PointerInput
}

export type MindmapCancelDragOptions = {
  pointer?: PointerInput
}

export type NodeDragStartOptions = {
  nodeId: NodeId
  pointer: PointerInput
}

export type NodeDragUpdateOptions = {
  pointer: PointerInput
}

export type NodeDragEndOptions = {
  pointer: PointerInput
}

export type NodeDragCancelOptions = {
  pointer?: PointerInput
}

export type {
  RoutingDragStartOptions,
  RoutingDragUpdateOptions,
  RoutingDragEndOptions,
  RoutingDragCancelOptions
} from './edge/routing'

export type NodeResizeStartOptions = {
  nodeId: NodeId
  pointer: PointerInput
  handle: ResizeDirection
  rect: Rect
  rotation: number
}

export type NodeRotateStartOptions = {
  nodeId: NodeId
  pointer: PointerInput
  rect: Rect
  rotation: number
}

export type NodeTransformUpdateOptions = {
  pointer: PointerInput
  minSize?: Size
}

export type NodeTransformEndOptions = {
  pointer: PointerInput
}

export type NodeTransformCancelOptions = {
  pointer?: PointerInput
}

export type GroupCommands = {
  create: (ids: NodeId[]) => Promise<DispatchResult>
  ungroup: (id: NodeId) => Promise<DispatchResult>
}

export type BaseMindmapCommands = {
  create: (payload?: { id?: MindmapId; rootId?: MindmapNodeId; rootData?: MindmapNodeData }) => Promise<DispatchResult>
  replace: (id: MindmapId, tree: MindmapTree) => Promise<DispatchResult>
  delete: (ids: MindmapId[]) => Promise<DispatchResult>
  addChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapIntentOptions
  ) => Promise<DispatchResult>
  addSibling: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapIntentOptions
  ) => Promise<DispatchResult>
  moveSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapIntentOptions
  ) => Promise<DispatchResult>
  removeSubtree: (id: MindmapId, nodeId: MindmapNodeId) => Promise<DispatchResult>
  cloneSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right' }
  ) => Promise<DispatchResult>
  toggleCollapse: (id: MindmapId, nodeId: MindmapNodeId, collapsed?: boolean) => Promise<DispatchResult>
  setNodeData: (id: MindmapId, nodeId: MindmapNodeId, patch: Partial<MindmapNodeData>) => Promise<DispatchResult>
  reorderChild: (id: MindmapId, parentId: MindmapNodeId, fromIndex: number, toIndex: number) => Promise<DispatchResult>
  setSide: (id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right') => Promise<DispatchResult>
  attachExternal: (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapIntentOptions
  ) => Promise<DispatchResult>
}

export type MindmapCommands = BaseMindmapCommands & {
  insertNode: (options: MindmapInsertNodeOptions) => Promise<void>
  moveSubtreeWithLayout: (options: MindmapMoveLayoutOptions) => Promise<DispatchResult>
  moveSubtreeWithDrop: (options: MindmapMoveDropOptions) => Promise<void>
  moveRoot: (options: MindmapMoveRootOptions) => Promise<void>
}

export type Commands = {
  doc: {
    reset: (doc: Document) => Promise<DispatchResult>
  }
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
    resetRouting: (edge: Edge) => void
    select: (id?: EdgeId) => void
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
  }
  group: GroupCommands
  mindmap: MindmapCommands
}
