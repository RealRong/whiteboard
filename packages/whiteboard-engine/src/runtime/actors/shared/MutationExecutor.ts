import type { CommandSource } from '@engine-types/command'
import type { DispatchResult, Intent, Operation } from '@whiteboard/core/types'

type MutationDispatch = (input: {
  operations: Operation[]
  source?: CommandSource
  actor?: string
}) => Promise<{ dispatchResult: DispatchResult }>

type MutationSource = 'command' | 'interaction'

type IntentDispatch = (
  intent: Intent,
  options: { source?: CommandSource; actor?: string }
) => Promise<DispatchResult>

type MutationExecutorOptions = {
  mutate: MutationDispatch
  dispatchIntent: IntentDispatch
}

export class MutationExecutor {
  private readonly mutate: MutationDispatch
  private readonly dispatchIntent: IntentDispatch

  constructor({ mutate, dispatchIntent }: MutationExecutorOptions) {
    this.mutate = mutate
    this.dispatchIntent = dispatchIntent
  }

  runCommand = async (
    command: Intent,
    actor: string,
    source: MutationSource = 'command'
  ): Promise<DispatchResult> =>
    this.dispatchIntent(command, { source, actor })

  runMutations = async (
    operations: Operation[],
    actor: string,
    source: MutationSource = 'command'
  ): Promise<DispatchResult> => {
    const applied = await this.mutate({
      operations,
      source,
      actor
    })
    return applied.dispatchResult
  }
}
