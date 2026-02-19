import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { InstanceEventMap } from '@engine-types/instance/events'
import { createDomBindings } from '../host/dom'
import { Events } from '../kernel/events'
import { createShortcuts, Lifecycle } from '../runtime'
import { resolveInstanceConfig } from '../config'
import { createCommands } from '../api/commands'
import { createRuntime } from '../runtime/factory/namespace'
import { createServices } from '../runtime/factory/services'
import { createInteractions } from '../runtime/interaction'
import { createState } from '../state/factory'
import { createView } from '../kernel/view'
import { createQuery } from '../api/query/instance'
import {
  createEngineContext,
  toChangePipelineContext,
  toCommandContext,
  toInteractionContext,
  toLifecycleContext,
  toServiceContext
} from '../context'
import { createChangePipeline } from '../change'

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
  const dom = createDomBindings(containerRef)
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
  let interaction!: RuntimeInternal['interaction']
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
    get interaction() {
      return interaction
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
  const context = createEngineContext({
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
    syncGraph: viewRuntime.syncGraph
  })

  state.write('tool', 'select')
  const changePipeline = createChangePipeline(
    toChangePipelineContext({
      context,
      instance,
      replaceDoc
    })
  )
  apply = changePipeline.apply
  tx = changePipeline.tx
  commands = createCommands(toCommandContext(context, instance))
  services = createServices(
    core,
    toServiceContext({
      context,
      apply,
      setViewport: commands.viewport.set,
      zoomViewportBy: commands.viewport.zoomBy
    })
  )
  interaction = createInteractions(toInteractionContext(context, instance))
  shortcuts = createShortcuts(instance)
  lifecycle = new Lifecycle(
    toLifecycleContext({
      context,
      commands
    }),
    dom
  )

  return instance
}
