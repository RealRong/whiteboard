import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { Commands } from '../command/api'
import type { InstanceConfig } from './config'
import type { Query } from './query'
import type { State } from './state'
import type { EngineRead } from './read'
import type { ViewportApi } from '../viewport/api'
import type { Api } from './runtime'

export type Instance = {
  state: State
  runtime: Api
  query: Query
  read: EngineRead
  commands: Commands
}

export type InternalInstance = Instance & {
  document: {
    get: () => Document
    set: (doc: Document) => void
    notifyChange: (doc: Document) => void
  }
  config: InstanceConfig
  viewport: ViewportApi
  registries: CoreRegistries
}

export type CreateEngineOptions = {
  registries?: CoreRegistries
  document: Document
  onDocumentChange?: (doc: Document) => void
  config?: Partial<InstanceConfig>
}
