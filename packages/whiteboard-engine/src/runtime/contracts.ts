import type { Commands } from '@engine-types/commands'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'

export type Scheduler = {
  raf: (callback: FrameRequestCallback) => number
  cancelRaf: (id: number) => void
  microtask: (callback: () => void) => void
  now: () => number
}

export type ServiceRuntimeContext = {
  state: State
  runtime: RuntimeInternal
  events: InstanceEventEmitter
  scheduler: Scheduler
  mutate: InternalInstance['mutate']
  setViewport: Commands['viewport']['set']
  zoomViewportBy: Commands['viewport']['zoomBy']
}

export type LifecycleRuntimeContext = {
  state: State
  query: Query
  view: View
  runtime: RuntimeInternal
  events: InstanceEventEmitter
  config: InstanceConfig
}
