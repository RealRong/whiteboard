import { getDefaultStore } from 'jotai'
import type {
  CreateWhiteboardInstanceOptions,
  WhiteboardInstance,
  WhiteboardInstanceConfig,
  WhiteboardRuntimeNamespace,
  WhiteboardStateKey,
  WhiteboardStateSnapshot,
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
import { DEFAULT_GROUP_PADDING } from '../../node/constants'

export const createWhiteboardInstance = ({
  core,
  docRef,
  containerRef,
  config: configOverrides
}: CreateWhiteboardInstanceOptions): WhiteboardInstance => {
  const config: WhiteboardInstanceConfig = {
    nodeSize: configOverrides?.nodeSize ?? DEFAULT_NODE_SIZE,
    mindmapNodeSize: configOverrides?.mindmapNodeSize ?? DEFAULT_MINDMAP_NODE_SIZE,
    node: {
      groupPadding: configOverrides?.node?.groupPadding ?? DEFAULT_GROUP_PADDING,
      snapThresholdScreen: configOverrides?.node?.snapThresholdScreen ?? 8,
      snapMaxThresholdWorld: configOverrides?.node?.snapMaxThresholdWorld ?? 24,
      snapGridCellSize: configOverrides?.node?.snapGridCellSize ?? 240,
      selectionMinDragDistance: configOverrides?.node?.selectionMinDragDistance ?? 3
    },
    edge: {
      hitTestThresholdScreen: configOverrides?.edge?.hitTestThresholdScreen ?? 10,
      anchorSnapMin: configOverrides?.edge?.anchorSnapMin ?? 12,
      anchorSnapRatio: configOverrides?.edge?.anchorSnapRatio ?? 0.18
    },
    viewport: {
      wheelSensitivity: configOverrides?.viewport?.wheelSensitivity ?? 0.001
    }
  }

  const getContainer = () => containerRef.current
  const services = {
    nodeSizeObserver: createNodeSizeObserverService(core),
    containerSizeObserver: createContainerSizeObserverService()
  }

  const shortcuts = createShortcutManager()
  const viewport = createViewportRuntime()
  const store = getDefaultStore()

  const stateAtoms = {
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
  } as const

  const getStateAtom = (key: WhiteboardStateKey) => stateAtoms[key]
  const readState = ((key: WhiteboardStateKey) =>
    store.get(getStateAtom(key) as never)) as WhiteboardStateNamespace['read']
  const watchState: WhiteboardStateNamespace['watch'] = (key, listener) => {
    return store.sub(getStateAtom(key) as never, listener)
  }
  const getStateSnapshot = (): WhiteboardStateSnapshot => ({
    interaction: readState('interaction'),
    tool: readState('tool'),
    selection: readState('selection'),
    edgeSelection: readState('edgeSelection'),
    edgeConnect: readState('edgeConnect'),
    spacePressed: readState('spacePressed'),
    dragGuides: readState('dragGuides'),
    groupHovered: readState('groupHovered'),
    nodeOverrides: readState('nodeOverrides'),
    canvasNodes: readState('canvasNodes'),
    visibleEdges: readState('visibleEdges')
  })

  const state: WhiteboardStateNamespace = {
    store,
    read: readState,
    watch: watchState,
    snapshot: getStateSnapshot
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

  const query = createInstanceQuery({
    store,
    config,
    getViewportZoom: viewport.getZoom,
    getContainer
  })

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
