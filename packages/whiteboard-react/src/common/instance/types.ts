import type { createStore } from 'jotai/vanilla'
import type {
  Commands as EngineCommands,
  EngineRead,
  Instance as EngineInstance,
  InstanceConfig as EngineInstanceConfig
} from '@whiteboard/engine'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { ResolvedHistoryConfig } from '../../types/common'
import type { EditorTool } from './toolState'
import type { WhiteboardSelectionCommands } from '../../selection/domain'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { WhiteboardViewport } from '../../viewport'

export type WhiteboardRuntimeConfig = {
  tool: EditorTool
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type WhiteboardCommands = Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
  tool: {
    set: (tool: EditorTool) => void
  }
  selection: WhiteboardSelectionCommands
  edge: EngineCommands['edge']
}

export type WhiteboardInstance = {
  config: Readonly<EngineInstanceConfig>
  read: EngineRead
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (config: WhiteboardRuntimeConfig) => void
  dispose: () => void
}

export type InternalWhiteboardState = {
  tool: () => EditorTool
  selectedNodeIds: () => readonly NodeId[]
  selectedEdgeId: () => EdgeId | undefined
}

export type InternalWhiteboardInstance = WhiteboardInstance & {
  engine: EngineInstance
  uiStore: ReturnType<typeof createStore>
  state: InternalWhiteboardState
}
