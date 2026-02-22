import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { Commands } from '../commands'
import type { ApplyMutationsApi } from '../command'
import type { RefLike } from '../ui'
import type { InstanceEvents } from './events'
import type { Lifecycle } from './lifecycle'
import type { InstanceConfig } from './config'
import type { Query } from './query'
import type { Runtime, RuntimeInternal } from './runtime'
import type { State } from './state'
import type { View } from './view'
import type { GraphProjector } from '../graph'
import type { InputPort } from '../input'

export type Instance = {
  state: State
  graph: GraphProjector
  input: InputPort
  runtime: Runtime
  query: Query
  view: View
  events: InstanceEvents
  lifecycle: Lifecycle
  commands: Commands
}

export type InternalInstance = Instance & {
  mutate: ApplyMutationsApi
  runtime: RuntimeInternal
}

export type CreateEngineOptions = {
  registries?: CoreRegistries
  document: Document
  onDocumentChange?: (doc: Document) => void
  containerRef: RefLike<HTMLDivElement | null>
  config?: Partial<InstanceConfig>
}
