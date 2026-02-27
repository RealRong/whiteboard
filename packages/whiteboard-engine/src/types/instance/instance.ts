import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { createStore } from 'jotai/vanilla'
import type { Commands } from '../commands'
import type { ApplyMutationsApi } from '../command'
import type { InstanceEventEmitter, InstanceEvents } from './events'
import type { Lifecycle } from './lifecycle'
import type { InstanceConfig } from './config'
import type { Query } from './query'
import type { State } from './state'
import type { EngineRead } from './read'
import type { ProjectionStore } from '../projection'
import type { ViewportApi } from '../viewport'
import type { DomainApis, DomainEntityApis } from '../domains'

export type Instance = {
  state: State
  projection: ProjectionStore
  runtime: {
    store: ReturnType<typeof createStore>
  }
  query: Query
  read: EngineRead
  domains: DomainApis
  node: DomainEntityApis['node']
  edge: DomainEntityApis['edge']
  mindmap: DomainEntityApis['mindmap']
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
