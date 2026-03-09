import type {
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapId,
  MindmapLayoutOptions,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { Size } from './common'

export type MindmapLayoutMode = 'simple' | 'tidy'

export type MindmapLayoutConfig = {
  mode?: MindmapLayoutMode
  options?: MindmapLayoutOptions
}

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
      type: 'insert.child'
      id: MindmapId
      parentId: MindmapNodeId
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapCommandOptions
    }
  | {
      type: 'insert.sibling'
      id: MindmapId
      nodeId: MindmapNodeId
      position: 'before' | 'after'
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapCommandOptions
    }
  | {
      type: 'insert.external'
      id: MindmapId
      targetId: MindmapNodeId
      payload: MindmapAttachPayload
      options?: MindmapCommandOptions
    }
  | ({
      type: 'insert.placement'
    } & MindmapInsertNodeOptions)

export type MindmapMoveCommand =
  | {
      type: 'move.subtree'
      id: MindmapId
      nodeId: MindmapNodeId
      newParentId: MindmapNodeId
      options?: MindmapCommandOptions
    }
  | ({
      type: 'move.layout'
    } & MindmapMoveLayoutOptions)
  | ({
      type: 'move.drop'
    } & MindmapMoveDropOptions)
  | {
      type: 'move.reorder'
      id: MindmapId
      parentId: MindmapNodeId
      fromIndex: number
      toIndex: number
    }
  | ({
      type: 'move.root'
    } & MindmapMoveRootOptions)

export type MindmapUpdateCommand =
  | {
      type: 'update.data'
      id: MindmapId
      nodeId: MindmapNodeId
      patch: Partial<MindmapNodeData>
    }
  | {
      type: 'update.collapse'
      id: MindmapId
      nodeId: MindmapNodeId
      collapsed?: boolean
    }
  | {
      type: 'update.side'
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
      type: 'clone.subtree'
      id: MindmapId
      nodeId: MindmapNodeId
      options?: MindmapCloneSubtreeOptions
    }
  | MindmapUpdateCommand
