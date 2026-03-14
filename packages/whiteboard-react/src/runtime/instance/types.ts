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
import type { Selection } from '../state/selection'
import type { WhiteboardSelectionCommands } from '../state/selection'
import type { WhiteboardContainerCommands } from '../state/container'
import type { WhiteboardContainerRead } from '../state/containerRead'
import type { NodeId, Point } from '@whiteboard/core/types'
import type { WhiteboardViewport } from '../viewport'
import type { Transient } from '../draft/runtime'
import type { NodeRegistry } from '../../types/node'
import type { WhiteboardView } from '../view'
import type { InteractionCoordinator } from '../interaction/types'
import type { ContextMenuState } from '../../ui/chrome/context-menu/domain'
import type { NodeToolbarMenuState } from '../../ui/chrome/toolbar/domain'
import type { ContextMenuOpenPayload } from '../../ui/chrome/context-menu/types'
import type { NodeToolbarMenuKey } from '../../ui/chrome/toolbar/model'
import type { ContextMenuOpenResult } from '../../ui/chrome/context-menu/view'

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
  contextMenu: {
    openResult: (args: {
      targetElement: Element | null
      screen: Point
      world: Point
    }) => ContextMenuOpenResult | undefined
  }
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
    contains: (nodeId: NodeId) => boolean
    subscribe: (listener: () => void) => () => void
    subscribeNode: (nodeId: NodeId, listener: () => void) => () => void
    subscribeEdge: (listener: () => void) => () => void
  }
  scope: {
    getContainerId: () => NodeId | undefined
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
  interaction: InteractionCoordinator
  registry: NodeRegistry
}
