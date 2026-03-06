import type {
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Viewport
} from '@whiteboard/core/types'
import type {
  CommandSource
} from './source'
import type { MindmapApplyCommand } from './mindmap'

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
