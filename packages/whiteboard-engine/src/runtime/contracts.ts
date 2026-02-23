import type { InstanceConfig } from '@engine-types/instance/config'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'
import type {
  DispatchResult,
  Point,
  Viewport
} from '@whiteboard/core/types'

export type Scheduler = {
  raf: (callback: FrameRequestCallback) => number
  cancelRaf: (id: number) => void
  microtask: (callback: () => void) => void
  now: () => number
}

export type GroupAutoFitContext = {
  runtime: RuntimeInternal
  scheduler: Scheduler
  mutate: InternalInstance['mutate']
}

export type ViewportNavigationContext = {
  state: State
  runtime: RuntimeInternal
  setViewport: (viewport: Viewport) => Promise<DispatchResult>
  zoomViewportBy: (factor: number, anchor?: Point) => Promise<DispatchResult>
}

export type LifecycleRuntimeContext = {
  state: State
  query: Query
  view: View
  runtime: RuntimeInternal
  events: InstanceEventEmitter
  config: InstanceConfig
}
