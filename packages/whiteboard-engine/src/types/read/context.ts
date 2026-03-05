import type { InstanceConfig } from '../instance/config'
import type { Query } from '../instance/query'
import type {
  EngineReadState,
  ReadSubscriptionKey
} from '../instance/read'
import type { ReadModelSnapshot } from './snapshot'

export type ReadRuntimeStateGetters = {
  interaction: () => EngineReadState['interaction']
  tool: () => EngineReadState['tool']
  selection: () => EngineReadState['selection']
  viewport: () => EngineReadState['viewport']
  mindmapLayout: () => EngineReadState['mindmapLayout']
}

export type ReadRuntimeContext = {
  state: ReadRuntimeStateGetters
  snapshot: () => ReadModelSnapshot
  subscribe: (
    keys: readonly ReadSubscriptionKey[],
    listener: () => void
  ) => () => void
  query: Query
  config: InstanceConfig
}
