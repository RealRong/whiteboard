import type {
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '../mindmap/layout'
import type { Size } from '../common/base'

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
