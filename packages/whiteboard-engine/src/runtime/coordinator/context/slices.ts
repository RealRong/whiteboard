import type { InternalInstance } from '@engine-types/instance/instance'
import type { Document } from '@whiteboard/core'
import type {
  ChangePipelineContext,
  CommandContext,
  EngineContext,
  InteractionContext,
  KernelContext,
  LifecycleContext,
  ServiceContext
} from './types'

export const toKernelContext = (
  context: EngineContext
): KernelContext => ({
  state: context.state,
  graph: context.graph,
  query: context.query,
  config: context.config,
  syncGraph: context.syncGraph,
  schedulers: context.schedulers
})

export const toCommandContext = (
  context: EngineContext,
  instance: InternalInstance
): CommandContext => ({
  instance,
  graph: context.graph,
  syncGraph: context.syncGraph
})

export const toInteractionContext = (
  context: EngineContext,
  instance: InternalInstance
): InteractionContext => ({
  instance,
  state: context.state,
  graph: context.graph,
  query: context.query,
  runtime: context.runtime,
  config: context.config,
  schedulers: context.schedulers
})

export const toServiceContext = (options: {
  context: EngineContext
  apply: ServiceContext['apply']
  setViewport: ServiceContext['setViewport']
  zoomViewportBy: ServiceContext['zoomViewportBy']
}): ServiceContext => ({
  state: options.context.state,
  runtime: options.context.runtime,
  events: options.context.events,
  schedulers: options.context.schedulers,
  apply: options.apply,
  setViewport: options.setViewport,
  zoomViewportBy: options.zoomViewportBy
})

export const toLifecycleContext = (
  options: {
    context: EngineContext
    commands: LifecycleContext['commands']
  }
): LifecycleContext => ({
  commands: options.commands,
  state: options.context.state,
  query: options.context.query,
  view: options.context.view,
  runtime: options.context.runtime,
  events: options.context.events,
  config: options.context.config
})

export const toChangePipelineContext = (options: {
  context: EngineContext
  instance: InternalInstance
  replaceDoc: (doc: Document | null) => void
}): ChangePipelineContext => ({
  instance: options.instance,
  replaceDoc: options.replaceDoc,
  syncGraph: options.context.syncGraph,
  emit: options.context.events.emit,
  now: options.context.schedulers.now
})
