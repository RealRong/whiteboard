import type {
  Document,
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
import type { CommitResult } from './commit'

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
  create: (payload?: MindmapCreateOptions) => Promise<CommitResult>
  replace: (id: MindmapId, tree: MindmapTree) => Promise<CommitResult>
  delete: (ids: MindmapId[]) => Promise<CommitResult>
  addChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<CommitResult>
  addSibling: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<CommitResult>
  attachExternal: (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<CommitResult>
  insertPlacement: (options: MindmapInsertNodeOptions) => Promise<CommitResult>
  moveSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapCommandOptions
  ) => Promise<CommitResult>
  moveLayout: (options: MindmapMoveLayoutOptions) => Promise<CommitResult>
  moveDrop: (options: MindmapMoveDropOptions) => Promise<CommitResult>
  reorderChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    fromIndex: number,
    toIndex: number
  ) => Promise<CommitResult>
  moveRoot: (options: MindmapMoveRootOptions) => Promise<CommitResult>
  removeSubtree: (id: MindmapId, nodeId: MindmapNodeId) => Promise<CommitResult>
  cloneSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: MindmapCloneSubtreeOptions
  ) => Promise<CommitResult>
  setNodeData: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    patch: Partial<MindmapNodeData>
  ) => Promise<CommitResult>
  toggleCollapse: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    collapsed?: boolean
  ) => Promise<CommitResult>
  setSide: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    side: 'left' | 'right'
  ) => Promise<CommitResult>
}

export type EngineCommands = {
  document: {
    replace: (doc: Document) => Promise<CommitResult>
  }
  history: {
    get: () => HistoryState
    undo: () => CommitResult
    redo: () => CommitResult
    clear: () => void
  }
  edge: {
    create: (payload: EdgeInput) => Promise<CommitResult>
    update: (id: EdgeId, patch: EdgePatch) => Promise<CommitResult>
    updateMany: (updates: readonly EdgeBatchUpdate[]) => Promise<CommitResult>
    delete: (ids: EdgeId[]) => Promise<CommitResult>
    routing: {
      insertAtPoint: (edgeId: EdgeId, pointWorld: Point) => Promise<CommitResult>
      move: (edgeId: EdgeId, index: number, pointWorld: Point) => Promise<CommitResult>
      remove: (edgeId: EdgeId, index: number) => Promise<CommitResult>
      reset: (edgeId: EdgeId) => Promise<CommitResult>
    }
    order: {
      set: (ids: EdgeId[]) => Promise<CommitResult>
      bringToFront: (ids: EdgeId[]) => Promise<CommitResult>
      sendToBack: (ids: EdgeId[]) => Promise<CommitResult>
      bringForward: (ids: EdgeId[]) => Promise<CommitResult>
      sendBackward: (ids: EdgeId[]) => Promise<CommitResult>
    }
  }
  node: {
    create: (payload: NodeInput) => Promise<CommitResult>
    update: (id: NodeId, patch: NodePatch) => Promise<CommitResult>
    updateMany: (
      updates: readonly NodeBatchUpdate[],
      options?: NodeUpdateManyOptions
    ) => Promise<CommitResult>
    updateData: (id: NodeId, patch: Record<string, unknown>) => Promise<CommitResult>
    delete: (ids: NodeId[]) => Promise<CommitResult>
    deleteCascade: (ids: NodeId[]) => Promise<CommitResult>
    duplicate: (ids: NodeId[]) => Promise<CommitResult>
    group: {
      create: (ids: NodeId[]) => Promise<CommitResult>
      ungroup: (id: NodeId) => Promise<CommitResult>
      ungroupMany: (ids: NodeId[]) => Promise<CommitResult>
    }
    order: {
      set: (ids: NodeId[]) => Promise<CommitResult>
      bringToFront: (ids: NodeId[]) => Promise<CommitResult>
      sendToBack: (ids: NodeId[]) => Promise<CommitResult>
      bringForward: (ids: NodeId[]) => Promise<CommitResult>
      sendBackward: (ids: NodeId[]) => Promise<CommitResult>
    }
  }
  mindmap: MindmapCommands
}
