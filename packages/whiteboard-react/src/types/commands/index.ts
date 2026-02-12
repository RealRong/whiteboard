import type {
  Core,
  DispatchResult,
  Edge,
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core'
import type { Guide } from '../node/snap'
import type { NodeDragGroupOptions } from '../node/drag'
import type { InteractionState, NodeViewUpdate, SelectionMode } from '../state'

export type WhiteboardCommands = {
  tool: {
    set: (tool: string) => void
  }
  keyboard: {
    setSpacePressed: (pressed: boolean) => void
  }
  history: {
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
  groupRuntime: {
    setHoveredGroupId: (groupId?: NodeId) => void
  }
  nodeDrag: {
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
    delete: (ids: NodeId[]) => Promise<DispatchResult>
    move: (ids: NodeId[], delta: { x: number; y: number }) => Promise<DispatchResult>
    resize: (id: NodeId, size: { width: number; height: number }) => Promise<DispatchResult>
    rotate: (id: NodeId, angle: number) => Promise<DispatchResult>
  }
  group: Core['commands']['group']
  mindmap: Core['commands']['mindmap']
}
