import type { Document } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { GraphChange, GraphProjector } from '@engine-types/graph'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'

export type SchedulerRuntime = {
  raf: (callback: FrameRequestCallback) => number
  cancelRaf: (id: number) => void
  microtask: (callback: () => void) => void
  now: () => number
}

export type EngineRuntimeContext = {
  state: State
  graph: GraphProjector
  query: Query
  view: View
  runtime: RuntimeInternal
  events: InstanceEventEmitter
  config: InstanceConfig
  syncGraph: (change: GraphChange) => void
  schedulers: SchedulerRuntime
}

export type ServiceRuntimeContext = Pick<
  EngineRuntimeContext,
  | 'state'
  | 'runtime'
  | 'events'
  | 'schedulers'
> & {
  apply: InternalInstance['apply']
  setViewport: Commands['viewport']['set']
  zoomViewportBy: Commands['viewport']['zoomBy']
}

export type CommandPipelineRuntimeContext = {
  instance: InternalInstance
  replaceDoc: (doc: Document | null) => void
  now?: () => number
}

export type LifecycleRuntimeContext = Pick<
  EngineRuntimeContext,
  | 'state'
  | 'query'
  | 'view'
  | 'runtime'
  | 'events'
  | 'config'
> & {
  commands: InternalInstance['commands']
}
