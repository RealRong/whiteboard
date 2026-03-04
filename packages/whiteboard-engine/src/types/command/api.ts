import type {
  Document,
  DispatchResult,
  EdgeId,
  EdgeInput,
  EdgePatch,
  MindmapAttachPayload,
  MindmapId,
  MindmapCommandOptions,
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
import type { MindmapLayoutConfig } from '../mindmap/layout'
import type {
  Size
} from '../common/base'
import type { PointerInput } from '../common/input'
import type { ResolvedHistoryConfig } from '../common/config'
import type {
  HistoryState,
  InteractionState,
  SelectionMode
} from '../state/model'
import type { ResizeDirection } from '../node/transform'
import type {
  CommandSource,
  CommandTrace
} from './source'

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

export type MindmapCreateOptions = {
  id?: MindmapId
  rootId?: MindmapNodeId
  rootData?: MindmapNodeData
}

export type MindmapCloneSubtreeOptions = {
  parentId?: MindmapNodeId
  index?: number
  side?: 'left' | 'right'
}

export type MindmapInsertCommand =
  | {
      type: 'insert'
      mode: 'child'
      id: MindmapId
      parentId: MindmapNodeId
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapCommandOptions
    }
  | {
      type: 'insert'
      mode: 'sibling'
      id: MindmapId
      nodeId: MindmapNodeId
      position: 'before' | 'after'
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapCommandOptions
    }
  | {
      type: 'insert'
      mode: 'external'
      id: MindmapId
      targetId: MindmapNodeId
      payload: MindmapAttachPayload
      options?: MindmapCommandOptions
    }
  | ({
      type: 'insert'
      mode: 'placement'
    } & MindmapInsertNodeOptions)

export type MindmapMoveCommand =
  | {
      type: 'move'
      mode: 'direct'
      id: MindmapId
      nodeId: MindmapNodeId
      newParentId: MindmapNodeId
      options?: MindmapCommandOptions
    }
  | ({
      type: 'move'
      mode: 'layout'
    } & MindmapMoveLayoutOptions)
  | ({
      type: 'move'
      mode: 'drop'
    } & MindmapMoveDropOptions)
  | {
      type: 'move'
      mode: 'reorder'
      id: MindmapId
      parentId: MindmapNodeId
      fromIndex: number
      toIndex: number
    }

export type MindmapUpdateCommand =
  | {
      type: 'update'
      mode: 'data'
      id: MindmapId
      nodeId: MindmapNodeId
      patch: Partial<MindmapNodeData>
    }
  | {
      type: 'update'
      mode: 'collapse'
      id: MindmapId
      nodeId: MindmapNodeId
      collapsed?: boolean
    }
  | {
      type: 'update'
      mode: 'side'
      id: MindmapId
      nodeId: MindmapNodeId
      side: 'left' | 'right'
    }

export type MindmapApplyCommand =
  | {
      type: 'create'
      payload?: MindmapCreateOptions
    }
  | {
      type: 'replace'
      id: MindmapId
      tree: MindmapTree
    }
  | {
      type: 'delete'
      ids: MindmapId[]
    }
  | MindmapInsertCommand
  | MindmapMoveCommand
  | {
      type: 'remove'
      id: MindmapId
      nodeId: MindmapNodeId
    }
  | {
      type: 'clone'
      id: MindmapId
      nodeId: MindmapNodeId
      options?: MindmapCloneSubtreeOptions
    }
  | MindmapUpdateCommand
  | ({
      type: 'root'
    } & MindmapMoveRootOptions)

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
      type: 'group.create'
      ids: NodeId[]
    }
  | {
      type: 'group.ungroup'
      id: NodeId
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
        trace?: CommandTrace
      }
    : never

export type MindmapCommands = {
  apply: (command: MindmapApplyCommand) => Promise<DispatchResult>
}

export type Commands = {
  doc: {
    reset: (doc: Document) => Promise<DispatchResult>
  }
  tool: {
    set: (tool: 'select' | 'edge') => void
  }
  history: {
    configure: (config: Partial<ResolvedHistoryConfig>) => void
    get: () => HistoryState
    undo: () => boolean
    redo: () => boolean
    clear: () => void
  }
  interaction: {
    update: (patch: Partial<InteractionState>) => void
    clearHover: () => void
  }
  host: {
    containerResized: (rect: { left: number; top: number; width: number; height: number }) => void
  }
  selection: {
    select: (ids: NodeId[], mode?: SelectionMode) => void
    toggle: (ids: NodeId[]) => void
    clear: () => void
    getSelectedNodeIds: () => NodeId[]
  }
  edge: {
    create: (payload: EdgeInput) => Promise<DispatchResult>
    update: (id: EdgeId, patch: EdgePatch) => Promise<DispatchResult>
    updateMany: (updates: readonly EdgeBatchUpdate[]) => void
    delete: (ids: EdgeId[]) => Promise<DispatchResult>
    select: (id?: EdgeId) => void
    routing: {
      insertAtPoint: (edgeId: EdgeId, pointWorld: Point) => void
      move: (edgeId: EdgeId, index: number, pointWorld: Point) => void
      remove: (edgeId: EdgeId, index: number) => void
      reset: (edgeId: EdgeId) => void
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
    updateMany: (updates: readonly NodeBatchUpdate[], options?: NodeUpdateManyOptions) => void
    updateData: (id: NodeId, patch: Record<string, unknown>) => Promise<DispatchResult> | undefined
    delete: (ids: NodeId[]) => Promise<DispatchResult>
    group: {
      create: (ids: NodeId[]) => Promise<DispatchResult>
      ungroup: (id: NodeId) => Promise<DispatchResult>
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
