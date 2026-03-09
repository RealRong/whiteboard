import type { createStore } from 'jotai/vanilla'
import type {
  Commands as EngineCommands,
  EngineRead,
  Instance as EngineInstance
} from '@whiteboard/engine'
import type { EdgeId, NodeId, Viewport } from '@whiteboard/core/types'
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
  viewport: Viewport
}

export type EditorStateKey = keyof EditorStateSnapshot

export type WhiteboardRuntimeConfig = {
  tool: EditorTool
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type WhiteboardState = {
  read: <K extends EditorStateKey>(key: K) => EditorStateSnapshot[K]
  subscribe: (keys: readonly EditorStateKey[], listener: () => void) => () => void
}

export type WhiteboardCommands = Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge'> & {
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
}

export type WhiteboardInstance = {
  state: WhiteboardState
  read: EngineRead
  commands: WhiteboardCommands
  runtime: {
    configure: (config: WhiteboardRuntimeConfig) => void
    viewport: ViewportRuntime
    dispose: () => void
  }
}

export type InternalWhiteboardInstance = WhiteboardInstance & {
  engine: EngineInstance
  uiStore: ReturnType<typeof createStore>
}
