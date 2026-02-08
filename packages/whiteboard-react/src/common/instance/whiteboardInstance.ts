import { getDefaultStore } from 'jotai'
import type {
  CreateWhiteboardInstanceOptions,
  WhiteboardInstance,
  WhiteboardInstanceConfig,
  WhiteboardRuntimeNamespace,
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
import { createInstanceQuery } from './query/createInstanceQuery'
import { createWhiteboardCommands } from './commands/createWhiteboardCommands'
import { setStoreAtom } from './store/setStoreAtom'

export const createWhiteboardInstance = ({
  core,
  docRef,
  containerRef,
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

  const shortcuts = createShortcutManager()
  const viewport = createViewportRuntime()
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

  const runtime: WhiteboardRuntimeNamespace = {
    core,
    docRef,
    containerRef,
    getContainer,
    config,
    viewport,
    services,
    shortcuts,
    events: {
      onWindow: (type, listener, options) => {
        window.addEventListener(type, listener as EventListener, options)
        return () => {
          window.removeEventListener(type, listener as EventListener, options)
        }
      },
      onContainer: (type, listener, options) => {
        const container = containerRef.current
        if (!container) return () => {}
        container.addEventListener(type, listener as EventListener, options)
        return () => {
          container.removeEventListener(type, listener as EventListener, options)
        }
      }
    }
  }

  const query = createInstanceQuery({ store, config })

  const instance = {
    state,
    runtime,
    query,
    commands: {} as WhiteboardInstance['commands']
  } as WhiteboardInstance

  setStoreAtom(store, toolAtom, 'select')
  instance.commands = createWhiteboardCommands(instance)

  return instance
}
