import type { InternalInstance } from '@engine-types/instance/instance'
import type { LifecycleRuntimeContext } from '../common/contracts'
import type { CleanupActors } from '../lifecycle/Cleanup'
import type { Actor as MindmapActor } from '../actors/mindmap/Actor'
import type { LifecycleRuntime } from './LifecycleGateway'

export type LifecycleRuntimeOptions = {
  context: LifecycleRuntimeContext
  cleanupActors: CleanupActors
  mindmap?: MindmapActor
}

export const createLifecycleRuntime = ({
  context,
  cleanupActors,
  mindmap
}: LifecycleRuntimeOptions): LifecycleRuntime => ({
  context,
  cleanupActors,
  actors: {
    mindmap
  }
})
