import type { ApplyMutationsApi, CommandSource } from '@engine-types/command'
import type { DispatchResult, Operation } from '@whiteboard/core/types'

export type RunMutations = (
  operations: Operation[],
  source?: CommandSource
) => Promise<DispatchResult>

export type SubmitMutations = (
  operations: Operation[],
  source?: CommandSource
) => void

export const createMutationCommit = (
  mutate: ApplyMutationsApi
): {
  run: RunMutations
  submit: SubmitMutations
} => {
  const run: RunMutations = async (
    operations,
    source = 'ui'
  ) =>
    mutate(operations, source)

  const submit: SubmitMutations = (
    operations,
    source = 'ui'
  ) => {
    void run(operations, source)
  }

  return { run, submit }
}
