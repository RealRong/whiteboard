import type { InternalInstance } from '@engine-types/instance/instance'
import type { DispatchResult, Intent, Operation } from '@whiteboard/core'

type MutationInstance = Pick<InternalInstance, 'runtime' | 'mutate'>

type MutationSource = 'command' | 'interaction'

export class MutationExecutor {
  private readonly instance: MutationInstance

  constructor(instance: MutationInstance) {
    this.instance = instance
  }

  runCommand = async (
    command: Intent,
    actor: string,
    source: MutationSource = 'command'
  ): Promise<DispatchResult> => {
    const built = this.instance.runtime.core.apply.build(command)
    if (!built.ok) return built

    const applied = await this.instance.mutate(built.operations, { source, actor })
    if (!applied.dispatchResult.ok) {
      return applied.dispatchResult
    }
    if (typeof built.value === 'undefined') {
      return applied.dispatchResult
    }

    return {
      ...applied.dispatchResult,
      value: built.value
    }
  }

  runMutations = async (
    operations: Operation[],
    actor: string,
    source: MutationSource = 'command'
  ): Promise<DispatchResult> => {
    const applied = await this.instance.mutate(operations, { source, actor })
    return applied.dispatchResult
  }
}
