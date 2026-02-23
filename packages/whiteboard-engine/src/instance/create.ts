import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { Commands } from '@engine-types/commands'
import { createRegistries } from '@whiteboard/core/kernel'
import type { InputConfig } from '@engine-types/input'
import type { LifecycleViewportConfig } from '@engine-types/instance/lifecycle'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { InstanceEventMap } from '@engine-types/instance/events'
import type { NodeId } from '@whiteboard/core/types'
import { EventCenter } from '../runtime/EventCenter'
import { createInputPort, createShortcuts } from '../input'
import { Lifecycle } from '../runtime/lifecycle/Lifecycle'
import { ChangeGateway } from '../runtime/gateway/ChangeGateway'
import { DEFAULT_CONFIG, resolveInstanceConfig } from '../config'
import { createState } from '../state/factory'
import { createDefaultPointerSessions } from '../input/sessions/defaults'
import { Scheduler } from '../runtime/Scheduler'
import { Actor as EdgeActor } from '../runtime/actors/edge/Actor'
import { Actor as HistoryActor } from '../runtime/actors/history/Actor'
import { Actor as InteractionActor } from '../runtime/actors/interaction/Actor'
import { Actor as MindmapActor } from '../runtime/actors/mindmap/Actor'
import { Actor as NodeActor } from '../runtime/actors/node/Actor'
import { GroupAutoFit, NodeSizeObserver } from '../runtime/actors/node/services'
import { Actor as SelectionActor } from '../runtime/actors/selection/Actor'
import { Actor as ShortcutActor } from '../runtime/actors/shortcut/Actor'
import {
  ContainerSizeObserver,
  ViewportNavigation
} from '../runtime/actors/viewport/services'
import { Domain as ViewportDomainActor } from '../runtime/actors/viewport/Domain'
import { ViewportRuntime } from '../runtime/viewport'
import { createQueryRuntime } from '../runtime/query/Store'
import { createViewRegistry } from '../runtime/view/Registry'
import { createDocumentStore } from '../document/Store'
import { createHistoryStore } from '../document/History'

const toOperationTypes = (operations: Array<{ type: string }>, reset = false) => {
  const types = new Set<string>()
  if (reset) {
    types.add('doc.reset')
  }
  operations.forEach((operation) => {
    types.add(operation.type)
  })
  return Array.from(types)
}

const toInputViewportConfig = (
  viewportConfig: LifecycleViewportConfig
): InputConfig['viewport'] => ({
  minZoom: viewportConfig.minZoom,
  maxZoom: viewportConfig.maxZoom,
  enablePan: viewportConfig.enablePan,
  enableWheel: viewportConfig.enableWheel,
  wheelSensitivity: viewportConfig.wheelSensitivity
})

const createDefaultInputConfig = (): InputConfig => ({
  viewport: {
    minZoom: DEFAULT_CONFIG.viewport.minZoom,
    maxZoom: DEFAULT_CONFIG.viewport.maxZoom,
    enablePan: DEFAULT_CONFIG.viewport.enablePan,
    enableWheel: DEFAULT_CONFIG.viewport.enableWheel,
    wheelSensitivity: DEFAULT_CONFIG.viewport.wheelSensitivity
  }
})

const createDeferred = <T,>(name: string) => {
  let value: T | undefined
  return {
    get: () => {
      if (typeof value === 'undefined') {
        throw new Error(`${name} is not ready.`)
      }
      return value
    },
    set: (next: T) => {
      value = next
    }
  }
}

export const createEngine = ({
  registries,
  document,
  onDocumentChange,
  containerRef,
  config: overrides
}: CreateEngineOptions): Instance => {
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(overrides)
  const runtimeRegistries = registries ?? createRegistries()
  const documentStore = createDocumentStore(document, onDocumentChange)
  const historyStore = createHistoryStore({ now: scheduler.now })
  const { state, projection, syncDocument } = createState({ getDoc: documentStore.get })
  const getContainer = () => containerRef.current
  const base = {
    document: documentStore,
    containerRef,
    getContainer,
    config,
    viewport: new ViewportRuntime()
  }
  const eventCenter = new EventCenter<InstanceEventMap>()
  const events = {
    on: eventCenter.on,
    off: eventCenter.off,
    emit: eventCenter.emit
  }
  const commandsRef = createDeferred<InternalInstance['commands']>('Commands')
  const inputRef = createDeferred<InternalInstance['input']>('Input')
  const servicesRef = createDeferred<RuntimeInternal['services']>('Runtime services')
  const shortcutsRef = createDeferred<RuntimeInternal['shortcuts']>('Runtime shortcuts')
  const lifecycleRef = createDeferred<InternalInstance['lifecycle']>('Lifecycle')
  let onDocApplied: ((operationTypes: string[]) => void) | undefined

  const queryRuntime = createQueryRuntime({
    projection,
    config,
    getContainer: base.getContainer
  })
  const viewRuntime = createViewRegistry({
    state,
    projection,
    query: queryRuntime.query,
    config
  })
  const changeGateway = new ChangeGateway({
    documentStore,
    history: historyStore,
    registries: runtimeRegistries,
    projection,
    sinks: [viewRuntime],
    syncStateFromDocument: syncDocument,
    now: scheduler.now,
    onApplied: ({ docId, origin, operations, reset }) => {
      const operationTypes = toOperationTypes(operations, reset)
      if (!operationTypes.length) return
      onDocApplied?.(operationTypes)
      events.emit('doc.changed', {
        docId,
        operationTypes,
        origin
      })
    }
  })

  const mutate = changeGateway.applyMutations
  const history = changeGateway.history
  const resetDoc = changeGateway.resetDocument

  const runtime: RuntimeInternal = {
    ...base,
    history,
    dom: {
      nodeSize: {
        observe: (nodeId, element, enabled) => {
          servicesRef.get().nodeSizeObserver.observe(nodeId, element, enabled)
        },
        unobserve: (nodeId) => {
          servicesRef.get().nodeSizeObserver.unobserve(nodeId)
        }
      }
    },
    get services() {
      return servicesRef.get()
    },
    get shortcuts() {
      return shortcutsRef.get()
    }
  }

  const instance: InternalInstance = {
    mutate,
    state,
    projection,
    get input() {
      return inputRef.get()
    },
    runtime,
    query: queryRuntime.query,
    view: viewRuntime.view,
    events: {
      on: events.on,
      off: events.off
    },
    get lifecycle() {
      return lifecycleRef.get()
    },
    get commands() {
      return commandsRef.get()
    }
  }
  state.write('tool', 'select')

  const edgeActor = new EdgeActor({
    instance,
    registries: runtimeRegistries,
    scheduler,
    mutate
  })
  const nodeActor = new NodeActor({
    state,
    projection,
    applyProjection: viewRuntime.applyProjection,
    readDoc: documentStore.get,
    registries: runtimeRegistries,
    instance,
    mutate
  })
  const mindmapActor = new MindmapActor({
    state,
    emit: events.emit,
    instance,
    mutate
  })
  const historyActor = new HistoryActor({
    instance,
    emit: events.emit
  })
  const interactionActor = new InteractionActor({
    state
  })
  const selectionActor = new SelectionActor({
    instance,
    emit: events.emit
  })
  const viewportActor = new ViewportDomainActor({
    instance,
    mutate
  })

  const { read, write } = state
  const commands: Commands = {
    doc: {
      reset: resetDoc
    },
    tool: {
      set: (tool) => {
        write('tool', tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        write('spacePressed', pressed)
      }
    },
    history: {
      configure: (historyConfig) => {
        history.configure(historyConfig)
      },
      undo: () => {
        if (!read('history').canUndo) return false
        return history.undo()
      },
      redo: () => {
        if (!read('history').canRedo) return false
        return history.redo()
      },
      clear: () => {
        history.clear()
      }
    },
    interaction: {
      update: interactionActor.update,
      clearHover: interactionActor.clearHover
    },
    selection: {
      select: selectionActor.select,
      toggle: selectionActor.toggle,
      clear: selectionActor.clear,
      getSelectedNodeIds: selectionActor.getSelectedNodeIds,
      beginBox: selectionActor.beginBox,
      updateBox: selectionActor.updateBox,
      endBox: selectionActor.endBox
    },
    edge: {
      create: edgeActor.create,
      update: edgeActor.update,
      delete: edgeActor.delete,
      insertRoutingPoint: edgeActor.insertRoutingPoint,
      moveRoutingPoint: edgeActor.moveRoutingPoint,
      removeRoutingPoint: edgeActor.removeRoutingPoint,
      resetRouting: edgeActor.resetRouting,
      select: edgeActor.select
    },
    order: {
      node: {
        set: nodeActor.setOrder,
        bringToFront: nodeActor.bringToFront,
        sendToBack: nodeActor.sendToBack,
        bringForward: nodeActor.bringForward,
        sendBackward: nodeActor.sendBackward
      },
      edge: {
        set: edgeActor.setOrder,
        bringToFront: edgeActor.bringToFront,
        sendToBack: edgeActor.sendToBack,
        bringForward: edgeActor.bringForward,
        sendBackward: edgeActor.sendBackward
      }
    },
    viewport: {
      set: viewportActor.set,
      panBy: viewportActor.panBy,
      zoomBy: viewportActor.zoomBy,
      zoomTo: viewportActor.zoomTo,
      reset: viewportActor.reset
    },
    node: {
      create: nodeActor.create,
      update: nodeActor.update,
      updateData: nodeActor.updateData,
      updateManyPosition: nodeActor.updateManyPosition,
      delete: nodeActor.delete
    },
    group: {
      create: nodeActor.createGroup,
      ungroup: nodeActor.ungroup
    },
    mindmap: {
      create: mindmapActor.create,
      replace: mindmapActor.replace,
      delete: mindmapActor.delete,
      addChild: mindmapActor.addChild,
      addSibling: mindmapActor.addSibling,
      moveSubtree: mindmapActor.moveSubtree,
      removeSubtree: mindmapActor.removeSubtree,
      cloneSubtree: mindmapActor.cloneSubtree,
      toggleCollapse: mindmapActor.toggleCollapse,
      setNodeData: mindmapActor.setNodeData,
      reorderChild: mindmapActor.reorderChild,
      setSide: mindmapActor.setSide,
      attachExternal: mindmapActor.attachExternal,
      insertNode: mindmapActor.insertNode,
      moveSubtreeWithLayout: mindmapActor.moveSubtreeWithLayout,
      moveSubtreeWithDrop: mindmapActor.moveSubtreeWithDrop,
      moveRoot: mindmapActor.moveRoot
    }
  }
  commandsRef.set(commands)

  const groupAutoFit = new GroupAutoFit({
    runtime,
    scheduler,
    mutate
  })
  const viewportNavigation = new ViewportNavigation({
    state,
    runtime,
    setViewport: viewportActor.set,
    zoomViewportBy: viewportActor.zoomBy
  })
  onDocApplied = groupAutoFit.onDocumentChanged
  servicesRef.set({
    nodeSizeObserver: new NodeSizeObserver(mutate, scheduler),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit,
    viewportNavigation
  })

  const shortcutActor = new ShortcutActor({
    selection: selectionActor,
    history: historyActor
  })
  shortcutsRef.set(
    createShortcuts({
      instance,
      runAction: shortcutActor.execute
    })
  )

  const inputPort = createInputPort({
    getContext: () => ({
      state,
      commands,
      query: queryRuntime.query,
      actors: {
        edge: edgeActor,
        node: nodeActor,
        mindmap: mindmapActor
      },
      services: {
        viewportNavigation: runtime.services.viewportNavigation
      },
      shortcuts: runtime.shortcuts,
      config
    }),
    config: createDefaultInputConfig(),
    sessions: createDefaultPointerSessions()
  })
  inputRef.set(inputPort)
  const lifecycleRuntime = new Lifecycle(
    {
      state,
      query: queryRuntime.query,
      view: viewRuntime.view,
      runtime,
      events,
      config
    },
    {
      onViewportConfigChange: (viewportConfig) => {
        inputPort.configure({
          viewport: toInputViewportConfig(viewportConfig)
        })
      }
    },
    {
      edge: edgeActor,
      node: nodeActor,
      mindmap: mindmapActor,
      history: historyActor,
      selection: selectionActor
    }
  )
  const lifecyclePort = {
    start: lifecycleRuntime.start,
    update: (nextConfig: Parameters<typeof lifecycleRuntime.update>[0]) => {
      lifecycleRuntime.update(nextConfig)
    },
    stop: () => {
      lifecycleRuntime.stop()
      scheduler.cancelAll()
    }
  }
  lifecycleRef.set(lifecyclePort)

  return instance
}
