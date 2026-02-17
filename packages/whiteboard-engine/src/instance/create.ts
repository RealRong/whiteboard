import type {
  CreateEngineOptions,
  InstanceEventMap,
  Instance,
  Runtime
} from '@engine-types/instance'
import { createDomBindings } from '../host/dom'
import { Events } from '../kernel/events'
import { createShortcuts, Lifecycle } from '../runtime'
import { resolveInstanceConfig } from '../config'
import { createCommands } from '../api/commands'
import { createRuntime, type RuntimeBase } from '../runtime/factory/namespace'
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
  const { state, writeState } = createState({ doc: docRef.current })
  const base = createRuntime({
    core,
    docRef,
    containerRef,
    config
  })
  const dom = createDomBindings(containerRef)
  const events = new Events<InstanceEventMap>()

  const query = createQuery({
    state,
    config,
    getContainer: base.getContainer
  })
  const view = createView({
    state,
    query,
    config,
    platform: base.platform
  })

  let commands!: Instance['commands']
  let services!: Runtime['services']
  let shortcuts!: Runtime['shortcuts']
  let lifecycle!: Runtime['lifecycle']

  const runtime: Runtime = {
    ...base,
    get services() {
      return services
    },
    get shortcuts() {
      return shortcuts
    },
    get lifecycle() {
      return lifecycle
    }
  }

  const instance: Instance = {
    state,
    runtime,
    query,
    view,
    events: {
      on: events.on,
      off: events.off
    },
    get commands() {
      return commands
    }
  }

  writeState('tool', 'select')
  commands = createCommands(instance)
  services = createServices(core, instance)
  shortcuts = createShortcuts(instance)
  lifecycle = new Lifecycle(instance, dom, events.emit)

  return instance
}
