import type { Core, Document } from '@whiteboard/core'
import type { Commands } from '../commands'
import type { ApplyApi, TxApi } from '../change'
import type { RefLike } from '../ui'
import type { InstanceEvents } from './events'
import type { Lifecycle } from './lifecycle'
import type { InstanceConfig } from './config'
import type { Query } from './query'
import type { Runtime, RuntimeInternal } from './runtime'
import type { State } from './state'
import type { View } from './view'
import type { GraphProjector } from '../graph'

export type Instance = {
  apply: ApplyApi
  tx: TxApi
  state: State
  graph: GraphProjector
  runtime: Runtime
  query: Query
  view: View
  events: InstanceEvents
  lifecycle: Lifecycle
  commands: Commands
}

export type InternalInstance = Omit<Instance, 'runtime'> & {
  runtime: RuntimeInternal
}

export type CreateEngineOptions = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  config?: Partial<InstanceConfig>
}
