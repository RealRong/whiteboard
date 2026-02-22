import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import { createRegistries } from '@whiteboard/core'
import type { InputConfig } from '@engine-types/input'
import type { LifecycleViewportConfig } from '@engine-types/instance/lifecycle'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { InstanceEventMap } from '@engine-types/instance/events'
import { Events } from '../runtime/common/events'
import { createInputPort, createShortcuts } from '../input'
import { Lifecycle } from '../runtime/lifecycle/Lifecycle'
import { ChangeGateway } from '../runtime/gateway/ChangeGateway'
import { createCommands } from '../api/commands'
import { DEFAULT_CONFIG, resolveInstanceConfig } from '../config'
import { createActorRuntime } from './actors'
import { createState } from '../state/factory'
import { createDefaultPointerSessions } from '../input/sessions/defaults'
import { Scheduler } from '../runtime/common/Scheduler'
import { GroupAutoFit, NodeSizeObserver } from '../runtime/actors/node/services'
import {
  ContainerSizeObserver,
  ViewportNavigation
} from '../runtime/actors/viewport/services'
import { ViewportRuntime } from '../runtime/viewport'
import { createQuery } from '../api/query/instance'
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
  const { state, graph, replaceDoc } = createState({ doc: documentStore.get() })
  const getContainer = () => containerRef.current
  const base = {
    document: documentStore,
    containerRef,
    getContainer,
    config,
    viewport: new ViewportRuntime()
  }
  const events = new Events<InstanceEventMap>()

  const queryRuntime = createQuery({
    graph,
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
    graph,
    get input() {
      return input
    },
    runtime,
    query: queryRuntime.query,
    get view() {
      return view
    },
    events: {
      on: events.on,
      off: events.off
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
    graph,
    query: queryRuntime.query,
    emit: events.emit,
    registries: runtimeRegistries,
    readDoc: documentStore.get,
    readNodes: () => runtime.document.get().nodes,
    config,
    syncQueryGraph: queryRuntime.syncGraph,
    scheduler,
    write: {
      mutate: (input) => mutate(input),
      dispatchIntent: (intent, options) => dispatchIntent(intent, options)
    }
  })
  view = actors.view.view
  const context = {
    state,
    query: queryRuntime.query,
    runtime,
    events: {
      on: events.on,
      off: events.off,
      emit: events.emit
    },
    config,
    scheduler
  }
  const changeGateway = new ChangeGateway({
    instance,
    documentStore,
    history: historyStore,
    registries: runtimeRegistries,
    replaceDoc,
    now: scheduler.now,
    graph: actors.graph,
    view: actors.view,
    emit: events.emit
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
      query: queryRuntime.query,
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
      mindmap: actors.mindmap
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
  const serviceContext = {
    state: context.state,
    runtime: context.runtime,
    events: context.events,
    scheduler,
    mutate,
    setViewport: commands.viewport.set,
    zoomViewportBy: commands.viewport.zoomBy
  }
  services = {
    nodeSizeObserver: new NodeSizeObserver(serviceContext.mutate),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit: new GroupAutoFit(serviceContext),
    viewportNavigation: new ViewportNavigation(serviceContext)
  }
  shortcuts = createShortcuts(instance)

  const publicInstance: Instance = {
    state: instance.state,
    graph: instance.graph,
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
