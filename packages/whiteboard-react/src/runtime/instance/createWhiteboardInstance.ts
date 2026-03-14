import type { Instance as EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  InternalWhiteboardState,
  InternalWhiteboardInstance,
  WhiteboardCommands,
  WhiteboardRuntimeConfig
} from './types'
import { createContainerDomain } from '../state/container'
import { createContainerRead } from '../state/containerRead'
import { createSelectionDomain } from '../state/selection'
import { createToolDomain } from './tool'
import { interactionLock } from '../interaction/interactionLock'
import type { WhiteboardViewport } from '../viewport'
import { createTransient } from '../draft'
import type { NodeRegistry } from '../../types/node'
import { createWhiteboardInteractionRuntime } from './interaction'
import { createWhiteboardView } from './view'
import { createContextMenuDomain } from '../../ui/chrome/context-menu/domain'
import { createNodeToolbarMenuDomain } from '../../ui/chrome/toolbar/domain'

export const createWhiteboardInstance = ({
  engine,
  uiStore,
  viewport,
  registry
}: {
  engine: EngineInstance
  uiStore: InternalWhiteboardInstance['uiStore']
  viewport: WhiteboardViewport
  registry: NodeRegistry
}): InternalWhiteboardInstance => {
  let instance!: InternalWhiteboardInstance
  const draft = createTransient(uiStore)

  const selection = createSelectionDomain({
    uiStore,
    readAllNodeIds: () => instance.read.node.ids()
  })
  const container = createContainerDomain({ uiStore })
  const tool = createToolDomain({ uiStore })
  const contextMenu = createContextMenuDomain({
    uiStore,
    readSelection: () => instance.view.selection.get(),
    restoreSelection: (value) => {
      if (value.edgeId !== undefined) {
        instance.commands.selection.selectEdge(value.edgeId)
        return
      }
      if (value.nodeIds.length > 0) {
        instance.commands.selection.select(value.nodeIds, 'replace')
        return
      }
      instance.commands.selection.clear()
    }
  })
  const toolbarMenu = createNodeToolbarMenuDomain({ uiStore })
  const interaction = createWhiteboardInteractionRuntime(() => instance)

  const state: InternalWhiteboardState = {
    tool: {
      get: tool.state
    },
    selection: {
      get: () => {
        const nodeIds = selection.state.selectedNodeIds()
        return {
          nodeIds,
          nodeIdSet: new Set(nodeIds),
          edgeId: selection.state.selectedEdgeId()
        }
      },
      getNodeIds: selection.state.selectedNodeIds,
      getEdgeId: selection.state.selectedEdgeId
    },
    scope: {
      getContainerId: () => {
        const containerId = container.state.activeContainerId()
        if (!containerId) return undefined
        return instance.read.index.node.byId(containerId)?.node ? containerId : undefined
      }
    },
    surface: {
      getContextMenu: contextMenu.state.get,
      getToolbarMenu: toolbarMenu.state.get
    }
  }

  const resetUiTransientState = () => {
    interaction.clear()
    selection.commands.clear()
    container.commands.clear()
    interactionLock.forceReset(instance)
    draft.clear()
  }

  const withUiReset = async (
    effect: Promise<DispatchResult>
  ) => {
    const result = await effect
    if (result.ok) {
      resetUiTransientState()
    }
    return result
  }

  const edge: WhiteboardCommands['edge'] = engine.commands.edge
  const read = {
    ...engine.read,
    container: createContainerRead({
      read: engine.read,
      activeContainerId: state.scope.getContainerId
    })
  }
  const view = createWhiteboardView(() => instance)

  instance = {
    engine,
    uiStore,
    state,
    draft,
    interaction,
    registry,
    config: engine.config,
    read,
    view,
    commands: {
      ...engine.commands,
      document: {
        replace: async (doc) =>
          withUiReset(engine.commands.document.replace(doc))
      },
      tool: tool.commands,
      selection: selection.commands,
      container: container.commands,
      surface: {
        openContextMenu: contextMenu.commands.open,
        closeContextMenu: (mode) => {
          if (mode === 'dismiss') {
            contextMenu.commands.closeDismiss()
            return
          }
          contextMenu.commands.closeAction()
        },
        openToolbarMenu: toolbarMenu.commands.open,
        toggleToolbarMenu: toolbarMenu.commands.toggle,
        closeToolbarMenu: toolbarMenu.commands.close
      },
      edge
    },
    viewport,
    configure: (config: WhiteboardRuntimeConfig) => {
      tool.commands.set(config.tool)
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      resetUiTransientState()
      engine.dispose()
    }
  }

  return instance
}
