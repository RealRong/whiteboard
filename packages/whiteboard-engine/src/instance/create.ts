import type {
  CreateInstanceOptions,
  Instance,
  Runtime
} from '@engine-types/instance'
import { createShortcuts, Lifecycle } from '../runtime'
import { resolveInstanceConfig } from '../config'
import { createCommands } from '../api/commands/compose'
import { createRuntime, createServices, type RuntimeBase } from '../runtime/factory'
import { createState } from '../state/factory'
import { createView } from '../state/view'
import { createInstanceQuery } from '../api/query/instance'

export const createInstance = ({
  core,
  docRef,
  containerRef,
  config: overrides
}: CreateInstanceOptions): Instance => {
  const config = resolveInstanceConfig(overrides)
  const { state, readState, writeState } = createState()
  const base = createRuntime({
    core,
    docRef,
    containerRef,
    config
  })

  const query = createInstanceQuery({
    readState,
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
    get commands() {
      return commands
    }
  }

  writeState('tool', 'select')
  commands = createCommands(instance)
  services = createServices(core, instance)
  shortcuts = createShortcuts(instance)
  lifecycle = new Lifecycle(instance)

  return instance
}
