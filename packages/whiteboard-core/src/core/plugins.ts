import type { CommandRegistry, Core, CoreRegistries, Plugin, PluginContext, PluginHost } from '../types/core'

export const createCommandRegistry = () => {
  const commandHandlers = new Map<string, (...args: unknown[]) => void>()
  const registry: CommandRegistry = {
    register: (name, handler) => {
      commandHandlers.set(name, handler)
      return () => {
        if (commandHandlers.get(name) === handler) {
          commandHandlers.delete(name)
        }
      }
    },
    get: (name) => commandHandlers.get(name),
    list: () => Array.from(commandHandlers.keys())
  }
  return {
    registry,
    commandHandlers
  }
}

type PluginRecord = {
  plugin: Plugin
  context: PluginContext
  disposers: Array<() => void>
  installed: boolean
  active: boolean
}

const registerPluginEntries = (record: PluginRecord, registries: CoreRegistries) => {
  const disposers: Array<() => void> = []
  const { plugin } = record
  if (plugin.commands) {
    Object.entries(plugin.commands).forEach(([name, handler]) => {
      disposers.push(registries.commands.register(name, handler))
    })
  }
  if (plugin.nodes) {
    plugin.nodes.forEach((definition) => {
      disposers.push(registries.nodeTypes.register(definition))
      if (definition.schema) {
        disposers.push(registries.schemas.registerNode(definition.schema))
      }
    })
  }
  if (plugin.edges) {
    plugin.edges.forEach((definition) => {
      disposers.push(registries.edgeTypes.register(definition))
      if (definition.schema) {
        disposers.push(registries.schemas.registerEdge(definition.schema))
      }
    })
  }
  if (plugin.schemas?.nodes) {
    plugin.schemas.nodes.forEach((schema) => {
      disposers.push(registries.schemas.registerNode(schema))
    })
  }
  if (plugin.schemas?.edges) {
    plugin.schemas.edges.forEach((schema) => {
      disposers.push(registries.schemas.registerEdge(schema))
    })
  }
  if (plugin.serializers) {
    plugin.serializers.forEach((serializer) => {
      disposers.push(registries.serializers.register(serializer))
    })
  }
  record.disposers = disposers
}

export const createPluginHost = (core: Core, registries: CoreRegistries): PluginHost => {
  const plugins = new Map<string, PluginRecord>()
  return {
    use: (plugin: Plugin) => {
      const id = plugin.manifest.id
      if (plugins.has(id)) return
      const context: PluginContext = { core, registries, commands: registries.commands }
      const record: PluginRecord = {
        plugin,
        context,
        disposers: [],
        installed: false,
        active: false
      }
      registerPluginEntries(record, registries)
      if (plugin.install && !record.installed) {
        plugin.install(context)
        record.installed = true
      }
      if (plugin.activate && !record.active) {
        plugin.activate(context)
        record.active = true
      } else {
        record.active = true
      }
      plugins.set(id, record)
    },
    has: (id: string) => plugins.has(id),
    activate: (id: string) => {
      const record = plugins.get(id)
      if (!record || record.active) return
      registerPluginEntries(record, registries)
      if (record.plugin.activate) {
        record.plugin.activate(record.context)
      }
      record.active = true
    },
    deactivate: (id: string) => {
      const record = plugins.get(id)
      if (!record || !record.active) return
      if (record.plugin.deactivate) {
        record.plugin.deactivate(record.context)
      }
      record.disposers.forEach((dispose) => dispose())
      record.disposers = []
      record.active = false
    },
    list: () => Array.from(plugins.values()).map((record) => record.plugin.manifest)
  }
}
