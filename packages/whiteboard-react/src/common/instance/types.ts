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
import type { Selection } from '../../selection/domain'
import type { WhiteboardSelectionCommands } from '../../selection/domain'
import type { WhiteboardContainerCommands } from '../../container/domain'
import type { WhiteboardContainerRead } from '../../container/read'
import type { NodeId } from '@whiteboard/core/types'
import type { WhiteboardViewport } from '../../viewport'
import type { Transient } from '../../transient/runtime'
import type { NodeRegistry } from '../../types/node'
import type { WhiteboardView } from './view'
import type { InteractionSession } from '../../interaction/session'
import type { ContextMenuState } from '../../context-menu/domain'
import type { NodeToolbarMenuState } from '../../toolbar/domain'
import type { ContextMenuOpenPayload } from '../../context-menu/types'
import type { NodeToolbarMenuKey } from '../../toolbar/model'

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
  container: WhiteboardContainerCommands
  session: {
    beginSelectionBox: () => void
    beginNodeDrag: () => void
    beginNodeTransform: () => void
    beginEdgeConnect: () => void
    beginEdgeRouting: () => void
    end: () => void
  }
  surface: {
    openContextMenu: (payload: ContextMenuOpenPayload) => void
    closeContextMenu: (mode: 'dismiss' | 'action') => void
    openToolbarMenu: (key: NodeToolbarMenuKey) => void
    toggleToolbarMenu: (key: NodeToolbarMenuKey) => void
    closeToolbarMenu: () => void
  }
  edge: EngineCommands['edge']
}

export type WhiteboardRead = EngineRead & {
  container: WhiteboardContainerRead
}

export type WhiteboardInstance = {
  config: Readonly<EngineInstanceConfig>
  read: WhiteboardRead
  view: WhiteboardView
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (config: WhiteboardRuntimeConfig) => void
  dispose: () => void
}

export type InternalWhiteboardState = {
  tool: {
    get: () => EditorTool
  }
  selection: {
    get: () => Selection
    getNodeIds: () => readonly NodeId[]
    getEdgeId: () => Selection['edgeId']
  }
  scope: {
    getContainerId: () => NodeId | undefined
  }
  session: {
    get: () => InteractionSession
  }
  surface: {
    getContextMenu: () => ContextMenuState
    getToolbarMenu: () => NodeToolbarMenuState
  }
}

export type InternalWhiteboardInstance = WhiteboardInstance & {
  engine: EngineInstance
  uiStore: ReturnType<typeof createStore>
  state: InternalWhiteboardState
  draft: Transient
  registry: NodeRegistry
}
