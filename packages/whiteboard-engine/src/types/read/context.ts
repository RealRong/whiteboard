import type { InstanceConfig } from '../instance/config'
import type { Query } from '../instance/query'
import type {
  EngineReadState,
  ReadSubscriptionKey
} from '../instance/read'
import type { ReadModelSnapshot } from './snapshot'

export type ReadContextKey = ReadSubscriptionKey
export type ReadKeyValueMap = EngineReadState & {
  snapshot: ReadModelSnapshot
}
export type ReadSubscribableInternalKey = ReadSubscriptionKey

export type ReadRuntimeContext = {
  get: <K extends ReadContextKey>(key: K) => ReadKeyValueMap[K]
  subscribe: (
    keys: readonly ReadSubscribableInternalKey[],
    listener: () => void
  ) => () => void
  query: Query
  config: InstanceConfig
}
