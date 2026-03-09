import type {
  Document,
  DispatchResult,
  EdgeId,
  EdgeInput,
  EdgePatch,
  MindmapId,
  MindmapNodeId,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core/types'
import type { PointerInput, Size } from './common'
import type { MindmapApplyCommand } from './mindmap'
import type { ResizeDirection } from './node'
import type { HistoryState } from './state'

export type CommandSource =
  | 'ui'
  | 'shortcut'
  | 'remote'
  | 'import'
  | 'system'
  | 'history'
  | 'interaction'

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

export type NodeBatchUpdate = {
  id: NodeId
  patch: NodePatch
}

export type NodeUpdateManyOptions = {
  source?: CommandSource
}

export type NodeWriteCommand =
  | {
      type: 'create'
      payload: NodeInput
    }
  | {
      type: 'updateMany'
      updates: readonly NodeBatchUpdate[]
    }
  | {
      type: 'delete'
      ids: NodeId[]
    }
  | {
      type: 'deleteCascade'
      ids: NodeId[]
    }
  | {
      type: 'duplicate'
      ids: NodeId[]
    }
  | {
      type: 'group.create'
      ids: NodeId[]
    }
  | {
      type: 'group.ungroup'
      id: NodeId
    }
  | {
      type: 'group.ungroupMany'
      ids: NodeId[]
    }
  | {
      type: 'order.set'
      ids: NodeId[]
    }

export type EdgeBatchUpdate = {
  id: EdgeId
  patch: EdgePatch
}

export type EdgeWriteCommand =
  | {
      type: 'create'
      payload: EdgeInput
    }
  | {
      type: 'updateMany'
      updates: readonly EdgeBatchUpdate[]
    }
  | {
      type: 'delete'
      ids: EdgeId[]
    }
  | {
      type: 'order.set'
      ids: EdgeId[]
    }
  | {
      type: 'routing.insertAtPoint'
      edgeId: EdgeId
      pointWorld: Point
    }
  | {
      type: 'routing.move'
      edgeId: EdgeId
      index: number
      pointWorld: Point
    }
  | {
      type: 'routing.remove'
      edgeId: EdgeId
      index: number
    }
  | {
      type: 'routing.reset'
      edgeId: EdgeId
    }

export type ViewportWriteCommand =
  | {
      type: 'set'
      viewport: Viewport
    }
  | {
      type: 'panBy'
      delta: { x: number; y: number }
    }
  | {
      type: 'zoomBy'
      factor: number
      anchor?: Point
    }
  | {
      type: 'zoomTo'
      zoom: number
      anchor?: Point
    }
  | {
      type: 'reset'
    }

export type MindmapWriteCommand = MindmapApplyCommand

export type WriteDomain =
  | 'node'
  | 'edge'
  | 'viewport'
  | 'mindmap'

export type WriteCommandMap = {
  node: NodeWriteCommand
  edge: EdgeWriteCommand
  viewport: ViewportWriteCommand
  mindmap: MindmapWriteCommand
}

export type WriteInput<D extends WriteDomain = WriteDomain> =
  D extends WriteDomain
    ? {
        domain: D
        command: WriteCommandMap[D]
        source?: CommandSource
      }
    : never

export type MindmapCommands = {
  apply: (command: MindmapApplyCommand) => Promise<DispatchResult>
}

export type Commands = {
  doc: {
    load: (doc: Document) => Promise<DispatchResult>
    replace: (doc: Document) => Promise<DispatchResult>
  }
  history: {
    get: () => HistoryState
    undo: () => boolean
    redo: () => boolean
    clear: () => void
  }
  edge: {
    create: (payload: EdgeInput) => Promise<DispatchResult>
    update: (id: EdgeId, patch: EdgePatch) => Promise<DispatchResult>
    updateMany: (updates: readonly EdgeBatchUpdate[]) => Promise<DispatchResult>
    delete: (ids: EdgeId[]) => Promise<DispatchResult>
    routing: {
      insertAtPoint: (edgeId: EdgeId, pointWorld: Point) => Promise<DispatchResult>
      move: (edgeId: EdgeId, index: number, pointWorld: Point) => Promise<DispatchResult>
      remove: (edgeId: EdgeId, index: number) => Promise<DispatchResult>
      reset: (edgeId: EdgeId) => Promise<DispatchResult>
    }
    order: {
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
    updateMany: (
      updates: readonly NodeBatchUpdate[],
      options?: NodeUpdateManyOptions
    ) => Promise<DispatchResult>
    updateData: (id: NodeId, patch: Record<string, unknown>) => Promise<DispatchResult>
    delete: (ids: NodeId[]) => Promise<DispatchResult>
    deleteCascade: (ids: NodeId[]) => Promise<DispatchResult>
    duplicate: (ids: NodeId[]) => Promise<DispatchResult>
    group: {
      create: (ids: NodeId[]) => Promise<DispatchResult>
      ungroup: (id: NodeId) => Promise<DispatchResult>
      ungroupMany: (ids: NodeId[]) => Promise<DispatchResult>
    }
    order: {
      set: (ids: NodeId[]) => Promise<DispatchResult>
      bringToFront: (ids: NodeId[]) => Promise<DispatchResult>
      sendToBack: (ids: NodeId[]) => Promise<DispatchResult>
      bringForward: (ids: NodeId[]) => Promise<DispatchResult>
      sendBackward: (ids: NodeId[]) => Promise<DispatchResult>
    }
  }
  mindmap: MindmapCommands
}
