import type { EdgeAnchor, EdgeId, NodeId, Point, Rect } from '@whiteboard/core'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionState = {
  selectedNodeIds: Set<NodeId>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  mode: SelectionMode
}

export type InteractionState = {
  focus: {
    isEditingText: boolean
    isInputFocused: boolean
    isImeComposing: boolean
  }
  pointer: {
    isDragging: boolean
    button?: 0 | 1 | 2
    modifiers: {
      alt: boolean
      shift: boolean
      ctrl: boolean
      meta: boolean
    }
  }
  hover: {
    nodeId?: NodeId
    edgeId?: EdgeId
  }
}

export type EdgeConnectFrom = {
  nodeId: NodeId
  anchor: EdgeAnchor
}

export type EdgeConnectTo = {
  nodeId?: NodeId
  anchor?: EdgeAnchor
  pointWorld?: Point
}

export type EdgeReconnectInfo = {
  edgeId: EdgeId
  end: 'source' | 'target'
}

export type EdgeConnectState = {
  isConnecting: boolean
  from?: EdgeConnectFrom
  to?: EdgeConnectTo
  hover?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
  pointerId?: number | null
}
