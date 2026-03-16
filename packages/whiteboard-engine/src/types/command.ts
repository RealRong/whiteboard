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
  Rect
} from '@whiteboard/core/types'
import type { PointerInput, Size } from './common'
import type {
  MindmapApplyCommand,
  MindmapCloneSubtreeOptions,
  MindmapCreateOptions
} from './mindmap'
import type { ResizeDirection } from './node'
import type { HistoryState } from './state'
import type {
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapNodeData,
  MindmapTree
} from '@whiteboard/core/types'
import type {
  MindmapInsertNodeOptions,
  MindmapMoveDropOptions,
  MindmapMoveLayoutOptions,
  MindmapMoveRootOptions
} from './mindmap'

export type CommandSource =
  | 'remote'
  | 'system'
  | 'user'

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
      type: 'data'
      mode: 'merge' | 'replace'
      id: NodeId
      patch: Record<string, unknown>
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
      type: 'order'
      mode: 'set' | 'front' | 'back' | 'forward' | 'backward'
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
      type: 'order'
      mode: 'set' | 'front' | 'back' | 'forward' | 'backward'
      ids: EdgeId[]
    }
  | {
      type: 'routing'
      mode: 'insert' | 'move' | 'remove' | 'reset'
      edgeId: EdgeId
      index?: number
      pointWorld?: Point
    }

export type MindmapWriteCommand = MindmapApplyCommand

export type WriteDomain =
  | 'node'
  | 'edge'
  | 'mindmap'

export type WriteCommandMap = {
  node: NodeWriteCommand
  edge: EdgeWriteCommand
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
  create: (payload?: MindmapCreateOptions) => Promise<DispatchResult>
  replace: (id: MindmapId, tree: MindmapTree) => Promise<DispatchResult>
  delete: (ids: MindmapId[]) => Promise<DispatchResult>
  addChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  addSibling: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  attachExternal: (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  insertPlacement: (options: MindmapInsertNodeOptions) => Promise<DispatchResult>
  moveSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  moveLayout: (options: MindmapMoveLayoutOptions) => Promise<DispatchResult>
  moveDrop: (options: MindmapMoveDropOptions) => Promise<DispatchResult>
  reorderChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    fromIndex: number,
    toIndex: number
  ) => Promise<DispatchResult>
  moveRoot: (options: MindmapMoveRootOptions) => Promise<DispatchResult>
  removeSubtree: (id: MindmapId, nodeId: MindmapNodeId) => Promise<DispatchResult>
  cloneSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: MindmapCloneSubtreeOptions
  ) => Promise<DispatchResult>
  setNodeData: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    patch: Partial<MindmapNodeData>
  ) => Promise<DispatchResult>
  toggleCollapse: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    collapsed?: boolean
  ) => Promise<DispatchResult>
  setSide: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    side: 'left' | 'right'
  ) => Promise<DispatchResult>
}

export type EngineCommands = {
  document: {
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
