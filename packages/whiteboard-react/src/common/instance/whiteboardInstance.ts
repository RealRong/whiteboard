import { getDefaultStore } from 'jotai'
import type { WhiteboardApi } from 'types/api'
import type {
  CreateWhiteboardInstanceOptions,
  WhiteboardInstance,
  WhiteboardInstanceCommands,
  WhiteboardInstanceConfig,
  WhiteboardStateNamespace
} from 'types/instance'
import {
  canvasNodesAtom,
  edgeConnectAtom,
  edgeSelectionAtom,
  interactionAtom,
  nodeSelectionAtom,
  spacePressedAtom,
  toolAtom,
  visibleEdgesAtom
} from '../state'
import { createShortcutManager } from '../shortcuts/shortcutManager'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from '../utils/geometry'
import { dragGuidesAtom, groupHoveredAtom, nodeViewOverridesAtom } from '../../node/state'
import { createContainerSizeObserverService } from './services/containerSizeObserverService'
import { createNodeSizeObserverService } from './services/nodeSizeObserverService'
import { createViewportRuntime } from './runtime/createViewportRuntime'
import { createWhiteboardApi } from './api/createWhiteboardApi'
import { createInstanceQuery } from './query/createInstanceQuery'
import { createWhiteboardCommands } from './commands/createWhiteboardCommands'
import { setStoreAtom } from './store/setStoreAtom'

export const createWhiteboardInstance = ({
  core,
  docRef,
  containerRef,
  shortcutManager: externalShortcutManager,
  config: configOverrides
}: CreateWhiteboardInstanceOptions): WhiteboardInstance => {
  const config: WhiteboardInstanceConfig = {
    nodeSize: configOverrides?.nodeSize ?? DEFAULT_NODE_SIZE,
    mindmapNodeSize: configOverrides?.mindmapNodeSize ?? DEFAULT_MINDMAP_NODE_SIZE
  }

  const getContainer = () => containerRef.current
  const services = {
    nodeSizeObserver: createNodeSizeObserverService(core),
    containerSizeObserver: createContainerSizeObserverService()
  }

  const shortcutManager = externalShortcutManager ?? createShortcutManager()
  const store = getDefaultStore()

  const state: WhiteboardStateNamespace = {
    store,
    atoms: {
      interaction: interactionAtom,
      tool: toolAtom,
      selection: nodeSelectionAtom,
      edgeSelection: edgeSelectionAtom,
      edgeConnect: edgeConnectAtom,
      spacePressed: spacePressedAtom,
      dragGuides: dragGuidesAtom,
      groupHovered: groupHoveredAtom,
      nodeOverrides: nodeViewOverridesAtom,
      canvasNodes: canvasNodesAtom,
      visibleEdges: visibleEdgesAtom
    },
    get: store.get,
    set: store.set,
    sub: (atom, callback) => store.sub(atom, callback)
  }

  const viewport = createViewportRuntime()

  const query = createInstanceQuery({ store, config })

  const instance = {
    core,
    docRef,
    containerRef,
    getContainer,
    config,
    services,
    shortcutManager,
    viewport,
    state,
    query,
    api: {} as WhiteboardApi,
    commands: {} as WhiteboardInstanceCommands,
    addWindowEventListener: (type, listener, options) => {
      window.addEventListener(type, listener as EventListener, options)
      return () => {
        window.removeEventListener(type, listener as EventListener, options)
      }
    },
    addContainerEventListener: (type, listener, options) => {
      const container = containerRef.current
      if (!container) return () => {}
      container.addEventListener(type, listener as EventListener, options)
      return () => {
        container.removeEventListener(type, listener as EventListener, options)
      }
    }
  } as WhiteboardInstance

  instance.api = createWhiteboardApi(instance)

  setStoreAtom(store, toolAtom, 'select')
  const commands = createWhiteboardCommands(instance) as WhiteboardInstanceCommands
  commands.extend = (partial) => {
    Object.assign(commands, partial)
  }
  instance.commands = commands

  return instance
}
