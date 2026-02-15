import type {
  CreateWhiteboardInstanceOptions,
  WhiteboardInstance,
  WhiteboardRuntimeNamespace
} from '@engine-types/instance'
import { createShortcutRuntime } from '../shortcuts'
import { resolveWhiteboardInstanceConfig } from '../config'
import { createWhiteboardCommands } from './commands/createWhiteboardCommands'
import { WhiteboardLifecycleRuntime } from './lifecycle/WhiteboardLifecycleRuntime'
import {
  createWhiteboardRuntimeNamespace,
  type WhiteboardRuntimeBase
} from './factory/createWhiteboardRuntimeNamespace'
import { createWhiteboardStateNamespace } from './factory/createWhiteboardStateNamespace'
import { createWhiteboardRuntimeServices } from './factory/createWhiteboardRuntimeServices'
import { createWhiteboardViewNamespace } from './factory/createWhiteboardViewNamespace'
import { createInstanceQuery } from './query/createInstanceQuery'

export const createWhiteboardInstance = ({
  core,
  docRef,
  containerRef,
  config: configOverrides
}: CreateWhiteboardInstanceOptions): WhiteboardInstance => {
  const config = resolveWhiteboardInstanceConfig(configOverrides)
  const { state, readState, writeState } = createWhiteboardStateNamespace()
  const runtimeBase = createWhiteboardRuntimeNamespace({
    core,
    docRef,
    containerRef,
    config
  })

  const query = createInstanceQuery({
    readState,
    platform: runtimeBase.platform,
    config,
    getViewportZoom: runtimeBase.viewport.getZoom,
    getContainer: runtimeBase.getContainer
  })
  const view = createWhiteboardViewNamespace({
    state,
    query,
    config
  })

  let commands!: WhiteboardInstance['commands']
  let services!: WhiteboardRuntimeNamespace['services']
  let shortcuts!: WhiteboardRuntimeNamespace['shortcuts']
  let lifecycle!: WhiteboardRuntimeNamespace['lifecycle']

  const runtime: WhiteboardRuntimeNamespace = {
    ...runtimeBase,
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

  const instance: WhiteboardInstance = {
    state,
    runtime,
    query,
    view,
    get commands() {
      return commands
    }
  }

  writeState('tool', 'select')
  commands = createWhiteboardCommands(instance)
  services = createWhiteboardRuntimeServices(core, instance)
  shortcuts = createShortcutRuntime(instance)
  lifecycle = new WhiteboardLifecycleRuntime(instance)

  return instance
}
