import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateKey,
  WhiteboardStateNamespace,
  WhiteboardViewKey,
  WhiteboardViewDebugSnapshot,
  WhiteboardViewNamespace,
  WhiteboardViewSnapshot
} from '@engine-types/instance'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { createDerivedRegistry } from '../../infra/derive'
import { createWhiteboardViewDerivations, WHITEBOARD_VIEW_KEYS } from './viewDerivations'

type CreateWhiteboardViewRegistryOptions = {
  state: WhiteboardStateNamespace
  query: WhiteboardInstanceQuery
  config: WhiteboardInstanceConfig
  platform: ShortcutContext['platform']
}

export const createWhiteboardViewRegistry = ({
  state,
  query,
  config,
  platform
}: CreateWhiteboardViewRegistryOptions): WhiteboardViewNamespace => {
  const resolvers = createWhiteboardViewDerivations({
    readState: state.read,
    query,
    config,
    platform
  })
  const derived = createDerivedRegistry<WhiteboardViewKey, WhiteboardStateKey, WhiteboardViewSnapshot>({
    keys: WHITEBOARD_VIEW_KEYS,
    resolvers,
    watchDependency: state.watch
  })

  return {
    read: derived.read,
    watch: derived.watch,
    snapshot: derived.snapshot,
    debug: {
      getMetrics: derived.debug.getMetric,
      getAllMetrics: () => derived.debug.getAllMetrics() as WhiteboardViewDebugSnapshot,
      resetMetrics: derived.debug.resetMetrics
    }
  }
}
