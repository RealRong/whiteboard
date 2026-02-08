import type { EdgeAnchor, EdgeId, NodeId, Point, Rect } from '@whiteboard/core'
import type { Guide } from '../node/snap'
import type { InteractionState, NodeViewUpdate, SelectionMode } from '../state'

export type WhiteboardApi = {
  tool: {
    set: (tool: string) => void
  }
  keyboard: {
    setSpacePressed: (pressed: boolean) => void
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
}
