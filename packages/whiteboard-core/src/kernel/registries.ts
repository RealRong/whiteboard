import type { CoreRegistries } from '../types'
import { createCommandRegistry } from '../core/plugins'
import { createCoreRegistries } from '../core/registry'

export const createRegistries = (): CoreRegistries => {
  const { registry } = createCommandRegistry()
  return createCoreRegistries(registry)
}
