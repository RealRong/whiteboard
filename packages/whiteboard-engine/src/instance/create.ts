import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { Command } from '@engine-types/command'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { InstanceEventMap } from '@engine-types/instance/events'
import { Events } from '../runtime/common/events'
import { createShortcuts } from '../runtime'
import { createDefaultInputConfig } from '../runtime/coordinator/InputRuntimeBuilder'
import { createCommands } from '../api/commands'
import { resolveInstanceConfig } from '../config'
import { createRuntime } from './runtime'
import { createServices } from './services'
import { createActorRuntime } from './actors'
import { createCoordinatorRuntime } from './coordinator'
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
    core: runtime.core,
    readDoc: () => runtime.docRef.current ?? null,
    readNodes: () => runtime.core.query.node.list(),
    syncGraph: viewRuntime.syncGraph,
    schedulers: context.schedulers
  })
  const applyChange = async (change: Command) => {
    const applied = await apply([change], { source: 'command' })
    const result = applied.dispatchResults[0]?.result
    if (!result) {
      throw new Error(`Command did not produce dispatch result: ${change.type}`)
    }
    return result
  }
  commands = createCommands({
    instance,
    node: actors.node,
    edge: actors.edge,
    applyChange
  })
  const coordinator = createCoordinatorRuntime({
    instance,
    replaceDoc,
    now: context.schedulers.now,
    commands,
    graph: actors.graph,
    view: actors.view,
    input: {
      state,
      commands,
      query: queryRuntime.query,
      actors: actors.port.inputActors,
      runtime,
      view: viewRuntime.view,
      config,
      inputConfig: createDefaultInputConfig(),
      sessions: createDefaultPointerSessions()
    },
    lifecycle: {
      context: {
        commands,
        state: context.state,
        query: context.query,
        view: context.view,
        runtime: context.runtime,
        events: context.events,
        config: context.config
      },
      cleanupActors: actors.port.cleanupActors,
      mindmap: actors.port.lifecycleActors.mindmap
    },
    emit: events.emit
  })
  apply = coordinator.apply
  tx = coordinator.tx
  commands = coordinator.commands
  input = coordinator.input
  lifecycle = coordinator.lifecycle
  services = createServices(
    core,
    {
      state: context.state,
      runtime: context.runtime,
      events: context.events,
      schedulers: context.schedulers,
      apply,
      setViewport: commands.viewport.set,
      zoomViewportBy: commands.viewport.zoomBy
    }
  )
  shortcuts = createShortcuts(instance)

  return instance
}
