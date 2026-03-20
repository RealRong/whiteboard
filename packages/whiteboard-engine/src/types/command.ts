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
  Operation,
  Point,
  Rect
} from '@whiteboard/core/types'
import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
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
import type { CommandResult } from './result'

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
      type: 'align'
      ids: readonly NodeId[]
      mode: NodeAlignMode
    }
  | {
      type: 'distribute'
      ids: readonly NodeId[]
      mode: NodeDistributeMode
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
      type: 'move'
      edgeId: EdgeId
      delta: Point
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
      type: 'path'
      mode: 'insert' | 'move' | 'remove' | 'clear'
      edgeId: EdgeId
      index?: number
      point?: Point
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

export type WriteInput<
  D extends WriteDomain = WriteDomain,
  C extends WriteCommandMap[D] = WriteCommandMap[D]
> = {
  domain: D
  command: C
  source?: CommandSource
}

export type NodeWriteOutput<C extends NodeWriteCommand = NodeWriteCommand> =
  C extends { type: 'create' }
    ? { nodeId: NodeId }
    : C extends { type: 'duplicate' }
      ? {
          nodeIds: readonly NodeId[]
          edgeIds: readonly EdgeId[]
        }
      : C extends { type: 'group.create' }
        ? { groupId: NodeId }
        : C extends ({ type: 'group.ungroup' } | { type: 'group.ungroupMany' })
          ? { nodeIds: readonly NodeId[] }
          : void

export type EdgeWriteOutput<C extends EdgeWriteCommand = EdgeWriteCommand> =
  C extends { type: 'create' }
    ? { edgeId: EdgeId }
    : C extends { type: 'path'; mode: 'insert' }
      ? { index: number }
      : void

export type MindmapWriteOutput<C extends MindmapWriteCommand = MindmapWriteCommand> =
  C extends { type: 'create' }
    ? {
        mindmapId: MindmapId
        rootId: MindmapNodeId
      }
    : C extends (
      | { type: 'insert.child' }
      | { type: 'insert.sibling' }
      | { type: 'insert.external' }
      | { type: 'insert.placement' }
    )
      ? { nodeId: MindmapNodeId }
      : C extends { type: 'clone.subtree' }
        ? {
            nodeId: MindmapNodeId
            map: Record<MindmapNodeId, MindmapNodeId>
          }
        : void

export type WriteOutput<
  D extends WriteDomain,
  C extends WriteCommandMap[D] = WriteCommandMap[D]
> =
  D extends 'node'
    ? NodeWriteOutput<Extract<C, NodeWriteCommand>>
    : D extends 'edge'
      ? EdgeWriteOutput<Extract<C, EdgeWriteCommand>>
      : D extends 'mindmap'
        ? MindmapWriteOutput<Extract<C, MindmapWriteCommand>>
        : never

export type MindmapCommands = {
  create: (payload?: MindmapCreateOptions) => CommandResult<{
    mindmapId: MindmapId
    rootId: MindmapNodeId
  }>
  replace: (id: MindmapId, tree: MindmapTree) => CommandResult
  delete: (ids: MindmapId[]) => CommandResult
  addChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => CommandResult<{ nodeId: MindmapNodeId }>
  addSibling: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => CommandResult<{ nodeId: MindmapNodeId }>
  attachExternal: (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => CommandResult<{ nodeId: MindmapNodeId }>
  insertPlacement: (options: MindmapInsertNodeOptions) => CommandResult<{ nodeId: MindmapNodeId }>
  moveSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapCommandOptions
  ) => CommandResult
  moveLayout: (options: MindmapMoveLayoutOptions) => CommandResult
  moveDrop: (options: MindmapMoveDropOptions) => CommandResult
  reorderChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    fromIndex: number,
    toIndex: number
  ) => CommandResult
  moveRoot: (options: MindmapMoveRootOptions) => CommandResult
  removeSubtree: (id: MindmapId, nodeId: MindmapNodeId) => CommandResult
  cloneSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: MindmapCloneSubtreeOptions
  ) => CommandResult<{
    nodeId: MindmapNodeId
    map: Record<MindmapNodeId, MindmapNodeId>
  }>
  setNodeData: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    patch: Partial<MindmapNodeData>
  ) => CommandResult
  toggleCollapse: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    collapsed?: boolean
  ) => CommandResult
  setSide: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    side: 'left' | 'right'
  ) => CommandResult
}

export type EngineCommands = {
  document: {
    apply: (
      operations: readonly Operation[],
      source?: CommandSource
    ) => CommandResult
    replace: (document: Document) => CommandResult
  }
  history: {
    get: () => HistoryState
    undo: () => CommandResult
    redo: () => CommandResult
    clear: () => void
  }
  edge: {
    create: (payload: EdgeInput) => CommandResult<{ edgeId: EdgeId }>
    move: (edgeId: EdgeId, delta: Point) => CommandResult
    update: (id: EdgeId, patch: EdgePatch) => CommandResult
    updateMany: (updates: readonly EdgeBatchUpdate[]) => CommandResult
    delete: (ids: EdgeId[]) => CommandResult
    path: {
      insert: (edgeId: EdgeId, point: Point) => CommandResult<{ index: number }>
      move: (edgeId: EdgeId, index: number, point: Point) => CommandResult
      remove: (edgeId: EdgeId, index: number) => CommandResult
      clear: (edgeId: EdgeId) => CommandResult
    }
    order: {
      set: (ids: EdgeId[]) => CommandResult
      bringToFront: (ids: EdgeId[]) => CommandResult
      sendToBack: (ids: EdgeId[]) => CommandResult
      bringForward: (ids: EdgeId[]) => CommandResult
      sendBackward: (ids: EdgeId[]) => CommandResult
    }
  }
  node: {
    create: (payload: NodeInput) => CommandResult<{ nodeId: NodeId }>
    update: (id: NodeId, patch: NodePatch) => CommandResult
    updateMany: (
      updates: readonly NodeBatchUpdate[],
      options?: NodeUpdateManyOptions
    ) => CommandResult
    align: (
      ids: readonly NodeId[],
      mode: NodeAlignMode
    ) => CommandResult
    distribute: (
      ids: readonly NodeId[],
      mode: NodeDistributeMode
    ) => CommandResult
    updateData: (id: NodeId, patch: Record<string, unknown>) => CommandResult
    delete: (ids: NodeId[]) => CommandResult
    deleteCascade: (ids: NodeId[]) => CommandResult
    duplicate: (ids: NodeId[]) => CommandResult<{
      nodeIds: readonly NodeId[]
      edgeIds: readonly EdgeId[]
    }>
    group: {
      create: (ids: NodeId[]) => CommandResult<{ groupId: NodeId }>
      ungroup: (id: NodeId) => CommandResult<{ nodeIds: readonly NodeId[] }>
      ungroupMany: (ids: NodeId[]) => CommandResult<{ nodeIds: readonly NodeId[] }>
    }
    order: {
      set: (ids: NodeId[]) => CommandResult
      bringToFront: (ids: NodeId[]) => CommandResult
      sendToBack: (ids: NodeId[]) => CommandResult
      bringForward: (ids: NodeId[]) => CommandResult
      sendBackward: (ids: NodeId[]) => CommandResult
    }
  }
  mindmap: MindmapCommands
}
