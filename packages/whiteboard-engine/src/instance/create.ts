import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { InputConfig } from '@engine-types/input'
import type { LifecycleViewportConfig } from '@engine-types/instance/lifecycle'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { InstanceEventMap } from '@engine-types/instance/events'
import { Events } from '../runtime/common/events'
import { createShortcuts } from '../runtime'
import { createInputPort } from '../input'
import { Lifecycle } from '../runtime/lifecycle/Lifecycle'
import { ChangeGateway } from '../runtime/gateway/ChangeGateway'
import { createCommands } from '../api/commands'
import { DEFAULT_CONFIG, resolveInstanceConfig } from '../config'
import { createRuntime } from './runtime'
import { createServices } from './services'
import { createActorRuntime } from './actors'
import { createState } from '../state/factory'
import { createDefaultPointerSessions } from '../input/sessions/defaults'
import { createView } from '../runtime/common/view'
import { createQuery } from '../api/query/instance'

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

const microtask = (callback: () => void) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback)
    return
  }
  void Promise.resolve().then(callback)
}

let fallbackRafId = 0
const fallbackRafTimers = new Map<number, ReturnType<typeof setTimeout>>()

const raf = (callback: FrameRequestCallback) => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback)
  }
  const id = ++fallbackRafId
  const timer = setTimeout(() => {
    fallbackRafTimers.delete(id)
    callback(now())
  }, 16)
  fallbackRafTimers.set(id, timer)
  return id
}

const cancelRaf = (id: number) => {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(id)
    return
  }
  const timer = fallbackRafTimers.get(id)
  if (!timer) return
  clearTimeout(timer)
  fallbackRafTimers.delete(id)
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

export const createEngine = ({
  core,
  docRef,
  containerRef,
  config: overrides
}: CreateEngineOptions): Instance => {
  const config = resolveInstanceConfig(overrides)
  const { state, graph, replaceDoc } = createState({ doc: docRef.current })
  const base = createRuntime({
    core,
    docRef,
    containerRef,
    config
  })
  const events = new Events<InstanceEventMap>()

  const queryRuntime = createQuery({
    graph,
    config,
    getContainer: base.getContainer
  })
  const viewRuntime = createView({
    state,
    graph,
    query: queryRuntime.query,
    config,
    platform: base.platform,
    syncQueryGraph: queryRuntime.syncGraph
  })

  let commands!: InternalInstance['commands']
  let apply!: InternalInstance['apply']
  let mutate!: InternalInstance['mutate']
  let tx!: InternalInstance['tx']
  let input!: InternalInstance['input']
  let services!: RuntimeInternal['services']
  let shortcuts!: RuntimeInternal['shortcuts']
  let lifecycle!: InternalInstance['lifecycle']

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
    }
  }

  const instance: InternalInstance = {
    get apply() {
      return apply
    },
    get mutate() {
      return mutate
    },
    get tx() {
      return tx
    },
    state,
    graph,
    get input() {
      return input
    },
    runtime,
    query: queryRuntime.query,
    view: viewRuntime.view,
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
  const context = {
    state,
    graph,
    query: queryRuntime.query,
    view: viewRuntime.view,
    runtime,
    events: {
      on: events.on,
      off: events.off,
      emit: events.emit
    },
    config,
    syncGraph: viewRuntime.syncGraph,
    schedulers: {
      raf,
      cancelRaf,
      microtask,
      now
    }
  }

  state.write('tool', 'select')
  const actors = createActorRuntime({
    instance,
    state,
    graph,
    query: queryRuntime.query,
    emit: events.emit,
    readDoc: () => runtime.docRef.current ?? null,
    readNodes: () => runtime.core.query.node.list(),
    syncGraph: viewRuntime.syncGraph,
    schedulers: context.schedulers
  })
  const changeGateway = new ChangeGateway({
    instance,
    replaceDoc,
    now: context.schedulers.now,
    graph: actors.graph,
    view: actors.view,
    emit: events.emit
  })

  commands = createCommands({
    instance,
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
      actors: actors.port.inputActors,
      services: {
        viewportNavigation: runtime.services.viewportNavigation
      },
      shortcuts: runtime.shortcuts,
      view: {
        getShortcutContext: () => viewRuntime.view.global.shortcutContext(),
        edgePath: (edgeId) => viewRuntime.view.edge.path(edgeId)
      },
      config
    }),
    config: createDefaultInputConfig(),
    sessions: createDefaultPointerSessions()
  })
  const lifecycleRuntime = new Lifecycle(
    {
      state: context.state,
      query: context.query,
      view: context.view,
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
    actors.port.cleanupActors,
    {
      mindmap: actors.port.lifecycleActors.mindmap
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
    }
  }
  apply = changeGateway.apply
  mutate = changeGateway.applyMutations
  tx = changeGateway.tx
  input = inputPort
  lifecycle = lifecyclePort
  services = createServices({
    state: context.state,
    runtime: context.runtime,
    events: context.events,
    schedulers: context.schedulers,
    mutate,
    setViewport: commands.viewport.set,
    zoomViewportBy: commands.viewport.zoomBy
  })
  shortcuts = createShortcuts(instance)

  return instance
}
