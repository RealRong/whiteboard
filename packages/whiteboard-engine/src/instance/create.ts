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
import { createState } from '../state/factory'
import { createView } from '../kernel/view'
import { createQuery } from '../api/query/instance'

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
  let services!: RuntimeInternal['services']
  let shortcuts!: RuntimeInternal['shortcuts']
  let lifecycle!: InternalInstance['lifecycle']

  const runtime: RuntimeInternal = {
    ...base,
    get services() {
      return services
    },
    get shortcuts() {
      return shortcuts
    }
  }

  const instance: InternalInstance = {
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
  services = createServices(core, instance)
  commands = createCommands(instance, graph, replaceDoc)
  shortcuts = createShortcuts(instance)
  lifecycle = new Lifecycle(instance, dom, events.emit, graph)

  return instance
}
