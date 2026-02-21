import type { Document, NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { PointerInput, PointerModifiers } from '@engine-types/common'
import type { GraphChange, GraphProjector } from '@engine-types/graph'
import type { InstanceConfig } from '@engine-types/instance/config'
import type {
  InstanceEventEmitter
} from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'

export type SchedulerContext = {
  raf: (callback: FrameRequestCallback) => number
  cancelRaf: (id: number) => void
  microtask: (callback: () => void) => void
  now: () => number
}

export type EngineContext = {
  state: State
  graph: GraphProjector
  query: Query
  view: View
  runtime: RuntimeInternal
  events: InstanceEventEmitter
  config: InstanceConfig
  syncGraph: (change: GraphChange) => void
  schedulers: SchedulerContext
}

export type KernelContext = Pick<
  EngineContext,
  | 'state'
  | 'graph'
  | 'query'
  | 'config'
  | 'syncGraph'
  | 'schedulers'
>

export type CommandContext = Pick<EngineContext, 'graph' | 'syncGraph'> & {
  instance: InternalInstance
}

export type InteractionContext = Pick<
  EngineContext,
  | 'state'
  | 'graph'
  | 'query'
  | 'runtime'
  | 'config'
  | 'schedulers'
> & {
  instance: InternalInstance
}

export type ServiceContext = Pick<
  EngineContext,
  | 'state'
  | 'runtime'
  | 'events'
  | 'schedulers'
> & {
  apply: InternalInstance['apply']
  setViewport: Commands['viewport']['set']
  zoomViewportBy: Commands['viewport']['zoomBy']
}

export type ChangePipelineContext = {
  instance: InternalInstance
  replaceDoc: (doc: Document | null) => void
  syncGraph: (change: GraphChange) => void
  emit: InstanceEventEmitter['emit']
  now?: () => number
}

export type LifecycleContext = Pick<
  EngineContext,
  | 'state'
  | 'query'
  | 'view'
  | 'runtime'
  | 'events'
  | 'config'
> & {
  commands: InternalInstance['commands']
}

export type FrameContext = {
  tool: 'select' | 'edge'
  selectedNodeIds: Set<NodeId>
  hoveredGroupId: NodeId | undefined
  viewportZoom: number
  docId: string | undefined
}

export type {
  PointerInput,
  PointerModifiers
}
