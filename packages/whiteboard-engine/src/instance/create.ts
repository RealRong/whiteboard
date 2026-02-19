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

  const query = createQuery({
    graph,
    config,
    getContainer: base.getContainer
  })
  const view = createView({
    state,
    graph,
    query,
    config,
    platform: base.platform
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
    query,
    view,
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
  const changePipeline = createChangePipeline({
    instance,
    replaceDoc,
    onDocChanged: (payload) => {
      events.emit('doc.changed', payload)
    },
    onApplied: (summary) => {
      events.emit('change.applied', summary)
    }
  })
  apply = changePipeline.apply
  tx = changePipeline.tx
  services = createServices(core, instance)
  commands = createCommands(instance, graph)
  interaction = createInteractions(instance)
  shortcuts = createShortcuts(instance)
  lifecycle = new Lifecycle(instance, dom, events.emit)

  return instance
}
