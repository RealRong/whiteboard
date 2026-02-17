import type {
  InstanceConfig,
  Query,
  StateKey,
  State,
  ViewKey,
  ViewDebugSnapshot,
  View,
  ViewSnapshot
} from '@engine-types/instance'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { createDerivedRegistry } from '../../infra/derive'
import { createViewDerivations, VIEW_KEYS } from './derivations'

type Options = {
  state: State
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
}

export const createViewRegistry = ({
  state,
  query,
  config,
  platform
}: Options): View => {
  const resolvers = createViewDerivations({
    readState: state.read,
    query,
    config,
    platform
  })
  const derived = createDerivedRegistry<ViewKey, StateKey, ViewSnapshot>({
    keys: VIEW_KEYS,
    resolvers,
    watchDependency: state.watch
  })

  return {
    read: derived.read,
    watch: derived.watch,
    snapshot: derived.snapshot,
    debug: {
      getMetrics: derived.debug.getMetric,
      getAllMetrics: () => derived.debug.getAllMetrics() as ViewDebugSnapshot,
      resetMetrics: derived.debug.resetMetrics
    }
  }
}
