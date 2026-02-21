import type { InternalInstance } from '@engine-types/instance/instance'
import type { CommandPipelineRuntimeContext } from '../runtime/common/contracts'
import {
  Coordinator,
  type CoordinatorDependencies
} from '../runtime/coordinator'
import {
  createInputRuntime,
  type InputRuntimeOptions
} from '../runtime/coordinator/InputRuntimeBuilder'
import {
  createLifecycleRuntime,
  type LifecycleRuntimeOptions
} from '../runtime/coordinator/LifecycleRuntimeBuilder'
import { createCommandPipeline } from '../runtime/actors/document/command'

type CreateCoordinatorRuntimeOptions = Omit<
  CoordinatorDependencies,
  'apply' | 'input' | 'lifecycle'
> & Pick<CommandPipelineRuntimeContext, 'replaceDoc'> & {
  instance: InternalInstance
  now: () => number
  input: InputRuntimeOptions
  lifecycle: LifecycleRuntimeOptions
}

export const createCoordinatorRuntime = ({
  instance,
  replaceDoc,
  now,
  input,
  lifecycle,
  ...coordinatorDeps
}: CreateCoordinatorRuntimeOptions): Coordinator => {
  const pipeline = createCommandPipeline({
    instance,
    replaceDoc,
    now
  })
  return new Coordinator({
    ...coordinatorDeps,
    input: createInputRuntime(input),
    lifecycle: createLifecycleRuntime(lifecycle),
    apply: pipeline.apply
  })
}
