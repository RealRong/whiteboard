import type {
  InstanceConfig,
  Query,
  State,
  View
} from '@engine-types/instance'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { createViewRegistry } from './registry'

type Options = {
  state: State
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
}

export const createView = ({
  state,
  query,
  config,
  platform
}: Options): View =>
  createViewRegistry({
    state,
    query,
    config,
    platform
  })
