import type { createStore } from 'jotai/vanilla'
import type {
  Commands as EngineCommands,
  EngineRead,
  Instance as EngineInstance,
  InstanceConfig as EngineInstanceConfig
} from '@whiteboard/engine'
import type { DispatchResult, EdgeId, NodeId, Point, Viewport } from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { ResolvedHistoryConfig } from '../../types/common'
import type {
  EditorInteractionState,
  EditorSelectionState,
  EditorTool,
  SelectionMode
} from './uiState'
import type { ViewportRuntime } from './runtime/viewport'

export type EditorStateSnapshot = {
  tool: EditorTool
  selection: EditorSelectionState
  interaction: EditorInteractionState
}

export type EditorStateKey = keyof EditorStateSnapshot

export type WhiteboardRuntimeConfig = {
  tool: EditorTool
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type WhiteboardSelectionState = {
  get: () => EditorSelectionState
  contains: (nodeId: NodeId) => boolean
  selectedEdgeId: () => EdgeId | undefined
  subscribe: (listener: () => void) => () => void
  subscribeNode: (nodeId: NodeId, listener: () => void) => () => void
  subscribeEdge: (listener: () => void) => () => void
}

export type WhiteboardState = {
  read: <K extends EditorStateKey>(key: K) => EditorStateSnapshot[K]
  subscribe: (keys: readonly EditorStateKey[], listener: () => void) => () => void
  selection: WhiteboardSelectionState
}

export type WhiteboardViewportCommands = {
  set: (viewport: Viewport) => Promise<DispatchResult>
  panBy: (delta: { x: number; y: number }) => Promise<DispatchResult>
  zoomBy: (factor: number, anchor?: Point) => Promise<DispatchResult>
  zoomTo: (zoom: number, anchor?: Point) => Promise<DispatchResult>
  reset: () => Promise<DispatchResult>
}

export type WhiteboardCommands = Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
  tool: {
    set: (tool: EditorTool) => void
  }
  interaction: {
    update: (patch: Partial<EditorInteractionState>) => void
    clearHover: () => void
  }
  selection: {
    select: (ids: NodeId[], mode?: SelectionMode) => void
    toggle: (ids: NodeId[]) => void
    selectAll: () => void
    clear: () => void
    getSelectedNodeIds: () => NodeId[]
  }
  edge: EngineCommands['edge'] & {
    select: (id?: EdgeId) => void
  }
  viewport: WhiteboardViewportCommands
}

export type WhiteboardInstance = {
  state: WhiteboardState
  config: Readonly<EngineInstanceConfig>
  read: EngineRead
  commands: WhiteboardCommands
  viewport: ViewportRuntime
  configure: (config: WhiteboardRuntimeConfig) => void
  dispose: () => void
}

export type InternalWhiteboardInstance = WhiteboardInstance & {
  engine: EngineInstance
  uiStore: ReturnType<typeof createStore>
}
