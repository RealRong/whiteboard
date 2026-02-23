import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import { createRegistries } from '@whiteboard/core/kernel'
import type { InputConfig } from '@engine-types/input'
import type { LifecycleViewportConfig } from '@engine-types/instance/lifecycle'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { InstanceEventMap } from '@engine-types/instance/events'
import { EventCenter } from '../runtime/EventCenter'
import { createInputPort, createShortcuts } from '../input'
import { Lifecycle } from '../runtime/lifecycle/Lifecycle'
import { ChangeGateway } from '../runtime/gateway/ChangeGateway'
import { createCommands } from '../api/commands'
import { DEFAULT_CONFIG, resolveInstanceConfig } from '../config'
import { createActorRuntime } from './actors'
import { createState } from '../state/factory'
import { createDefaultPointerSessions } from '../input/sessions/defaults'
import { Scheduler } from '../runtime/Scheduler'
import { SyncCoordinator } from '../runtime/sync/Coordinator'
import { GroupAutoFit, NodeSizeObserver } from '../runtime/actors/node/services'
import { Actor as ShortcutActor } from '../runtime/actors/shortcut/Actor'
import {
  ContainerSizeObserver,
  ViewportNavigation
} from '../runtime/actors/viewport/services'
import { ViewportRuntime } from '../runtime/viewport'
import { QueryStore } from '../runtime/query/Store'
import { createDocumentStore } from '../document/Store'
import { createHistoryStore } from '../document/History'

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
  const { state, projection, replaceDoc } = createState({ doc: documentStore.get() })
  const getContainer = () => containerRef.current
  const base = {
    document: documentStore,
    containerRef,
    getContainer,
    config,
    viewport: new ViewportRuntime()
  }
  const eventCenter = new EventCenter<InstanceEventMap>()

  const queryStore = new QueryStore({
    projection,
    config,
    getContainer: base.getContainer
  })

  let commands!: InternalInstance['commands']
  let mutate: InternalInstance['mutate'] = async () => {
    throw new Error('Mutation gateway is not ready.')
  }
  let dispatchIntent: ChangeGateway['dispatchIntent'] = async () => {
    throw new Error('Intent gateway is not ready.')
  }
  let resetDoc: ChangeGateway['resetDocument'] = async () => {
    throw new Error('Document gateway is not ready.')
  }
  let input!: InternalInstance['input']
  let services!: RuntimeInternal['services']
  let shortcuts!: RuntimeInternal['shortcuts']
  let history!: RuntimeInternal['history']
  let lifecycle!: InternalInstance['lifecycle']
  let view!: InternalInstance['view']

  const runtime: RuntimeInternal = {
    ...base,
    dom: {
      nodeSize: {
        observe: (nodeId, element, enabled) => {
          services.nodeSizeObserver.observe(nodeId, element, enabled)
        },
        unobserve: (nodeId) => {
          services.nodeSizeObserver.unobserve(nodeId)
        }
      }
    },
    get services() {
      return services
    },
    get shortcuts() {
      return shortcuts
    },
    get history() {
      return history
    }
  }

  const instance: InternalInstance = {
    get mutate() {
      return mutate
    },
    state,
    projection,
    get input() {
      return input
    },
    runtime,
    query: queryStore.query,
    get view() {
      return view
    },
    events: {
      on: eventCenter.on,
      off: eventCenter.off
    },
    get lifecycle() {
      return lifecycle
    },
    get commands() {
      return commands
    }
  }
  state.write('tool', 'select')
  const actors = createActorRuntime({
    instance,
    state,
    projection,
    query: queryStore.query,
    emit: eventCenter.emit,
    registries: runtimeRegistries,
    readDoc: documentStore.get,
    config,
    scheduler,
    write: {
      mutate: (input) => mutate(input),
      dispatchIntent: (intent, options) => dispatchIntent(intent, options)
    }
  })
  view = actors.view.view
  const context = {
    state,
    query: queryStore.query,
    runtime,
    events: {
      on: eventCenter.on,
      off: eventCenter.off,
      emit: eventCenter.emit
    },
    config,
    scheduler
  }
  const syncCoordinator = new SyncCoordinator({
    projection,
    query: queryStore,
    view: actors.view
  })
  const changeGateway = new ChangeGateway({
    documentStore,
    history: historyStore,
    registries: runtimeRegistries,
    replaceDoc,
    now: scheduler.now,
    sync: syncCoordinator,
    emit: eventCenter.emit
  })
  history = changeGateway.history
  mutate = changeGateway.applyMutations
  dispatchIntent = changeGateway.dispatchIntent
  resetDoc = changeGateway.resetDocument

  commands = createCommands({
    instance,
    history,
    resetDoc,
    node: actors.node,
    edge: actors.edge,
    mindmap: actors.mindmap,
    viewport: actors.viewport
  })
  const inputPort = createInputPort({
    getContext: () => ({
      state,
      commands,
      query: queryStore.query,
      actors: actors.inputActors,
      services: {
        viewportNavigation: runtime.services.viewportNavigation
      },
      shortcuts: runtime.shortcuts,
      config
    }),
    config: createDefaultInputConfig(),
    sessions: createDefaultPointerSessions()
  })
  const lifecycleRuntime = new Lifecycle(
    {
      state: context.state,
      query: context.query,
      view,
      runtime: context.runtime,
      events: context.events,
      config: context.config
    },
    {
      onViewportConfigChange: (viewportConfig) => {
        inputPort.configure({
          viewport: toInputViewportConfig(viewportConfig)
        })
      }
    },
    {
      edge: actors.edge,
      node: actors.node,
      mindmap: actors.mindmap,
      history: actors.history,
      selection: actors.selection
    }
  )
  let lifecycleStarted = false
  const lifecyclePort = {
    start: () => {
      if (lifecycleStarted) return
      lifecycleStarted = true
      lifecycleRuntime.start()
    },
    update: (nextConfig: Parameters<typeof lifecycleRuntime.update>[0]) => {
      lifecycleRuntime.update(nextConfig)
    },
    stop: () => {
      if (!lifecycleStarted) return
      lifecycleStarted = false
      lifecycleRuntime.stop()
      scheduler.cancelAll()
    }
  }
  input = inputPort
  lifecycle = lifecyclePort
  const groupAutoFit = new GroupAutoFit({
    runtime: context.runtime,
    scheduler,
    mutate
  })
  const viewportNavigation = new ViewportNavigation({
    state: context.state,
    runtime: context.runtime,
    setViewport: commands.viewport.set,
    zoomViewportBy: commands.viewport.zoomBy
  })

  changeGateway.onDocChanged(groupAutoFit.onDocumentChanged)

  services = {
    nodeSizeObserver: new NodeSizeObserver(mutate, scheduler),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit,
    viewportNavigation
  }
  const shortcutActor = new ShortcutActor({
    selection: actors.selection,
    history: actors.history
  })
  shortcuts = createShortcuts({
    instance,
    runAction: shortcutActor.execute
  })

  const publicInstance: Instance = {
    state: instance.state,
    projection: instance.projection,
    get input() {
      return instance.input
    },
    runtime: instance.runtime,
    query: instance.query,
    view: instance.view,
    events: instance.events,
    get lifecycle() {
      return instance.lifecycle
    },
    get commands() {
      return instance.commands
    }
  }

  return publicInstance
}
