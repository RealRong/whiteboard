import type {
  ChangeSet,
  DispatchFailure,
  DispatchResult,
  Document,
  Origin
} from '../../types/core'
import { createKernelApply } from './apply'
import { createKernelQuery } from './query'
import { createKernelState } from './state'

export type KernelExecutor = {
  load: (document: Document) => void
  applyOperations: (operations: readonly ChangeSet['operations'][number][], origin?: Origin) => DispatchResult
  applyChangeSet: (changes: ChangeSet) => DispatchResult
  query: ReturnType<typeof createKernelQuery>
}

const createFailure = (
  reason: DispatchFailure['reason'],
  message?: string
): DispatchFailure => ({
  ok: false,
  reason,
  message
})

export const createKernelExecutor = ({
  document,
  now
}: {
  document: Document
  now?: () => number
}): KernelExecutor => {
  const state = createKernelState({
    document,
    now
  })

  const createChangeSet = (
    operations: ChangeSet['operations'],
    origin?: Origin
  ): ChangeSet => ({
    id: state.createChangeSetId(),
    timestamp: state.now(),
    operations,
    origin
  })

  const apply = createKernelApply({
    state,
    createChangeSet,
    createFailure
  })

  return {
    load: state.loadDocument,
    applyOperations: apply.applyOperations,
    applyChangeSet: apply.applyChangeSet,
    query: createKernelQuery(state)
  }
}
