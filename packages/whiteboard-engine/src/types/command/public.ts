import type {
  Document,
  DispatchResult,
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Viewport
} from '@whiteboard/core/types'
import type { ResolvedHistoryConfig } from '../common/config'
import type {
  HistoryState,
  InteractionState,
  SelectionMode
} from '../state/model'
import type {
  EdgeBatchUpdate,
  NodeBatchUpdate,
  NodeUpdateManyOptions
} from './write'
import type { MindmapApplyCommand } from './mindmap'

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
