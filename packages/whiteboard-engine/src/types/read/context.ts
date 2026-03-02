import type { InstanceConfig } from '../instance/config'
import type { Query } from '../instance/query'
import type {
  ReadInternalKey,
  ReadSubscribeKey,
  ReadInternalValueMap
} from '../instance/read'

export type ReadContextKey = ReadInternalKey
export type ReadKeyValueMap = ReadInternalValueMap
export type ReadSubscribableInternalKey = ReadSubscribeKey

export type ReadRuntimeContext = {
  get: <K extends ReadContextKey>(key: K) => ReadKeyValueMap[K]
  subscribe: (
    keys: readonly ReadSubscribableInternalKey[],
    listener: () => void
  ) => () => void
  query: Query
  config: InstanceConfig
}
