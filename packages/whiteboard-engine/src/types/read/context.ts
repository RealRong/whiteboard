import type { InstanceConfig } from '../instance/config'
import type {
  EngineReadState,
  ReadSubscriptionKey
} from '../instance/read'
import type { ReadIndexes } from './indexes/indexer'
import type { ReadModel } from './model'

export type ReadStateGetters = {
  viewport: () => EngineReadState['viewport']
  mindmapLayout: () => EngineReadState['mindmapLayout']
}

export type ReadContext = {
  state: ReadStateGetters
  model: () => ReadModel
  subscribe: (
    keys: readonly ReadSubscriptionKey[],
    listener: () => void
  ) => () => void
  indexes: ReadIndexes
  config: InstanceConfig
}
