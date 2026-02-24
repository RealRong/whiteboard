import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { Commands } from '../commands'
import type { ApplyMutationsApi } from '../command'
import type { InstanceEventEmitter, InstanceEvents } from './events'
import type { Lifecycle } from './lifecycle'
import type { InstanceConfig } from './config'
import type { Query } from './query'
import type { State } from './state'
import type { View } from './view'
import type { ProjectionStore } from '../projection'
import type { InputPort } from '../input'
import type { ViewportApi } from '../viewport'

export type Instance = {
  state: State
  projection: ProjectionStore
  input: InputPort
  query: Query
  view: View
  events: InstanceEvents
  lifecycle: Lifecycle
  commands: Commands
}

export type InternalInstance = Instance & {
  mutate: ApplyMutationsApi
  emit: InstanceEventEmitter['emit']
  document: {
    get: () => Document
    replace: (doc: Document, options?: { silent?: boolean }) => void
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
