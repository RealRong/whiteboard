import type { ApplyOptions, ChangeSet, ChangeSource } from '@engine-types/change'
import type { DocumentId } from '@whiteboard/core'
import type { ValidatedChangeSetInput } from './validate'

type NormalizeContext = {
  docId?: DocumentId
  source?: ChangeSource
}

const createChangeSetId = () => {
  const random = Math.random().toString(36).slice(2, 10)
  return `cs_${Date.now().toString(36)}_${random}`
}

export const normalizeChangeSet = (
  input: ValidatedChangeSetInput,
  options: ApplyOptions | undefined,
  context: NormalizeContext
): ChangeSet => {
  const meta = input.meta

  return {
    id: options?.id ?? meta?.id ?? createChangeSetId(),
    docId: options?.docId ?? meta?.docId ?? context.docId,
    source: options?.source ?? meta?.source ?? context.source ?? 'system',
    actor: options?.actor ?? meta?.actor,
    timestamp: options?.timestamp ?? meta?.timestamp ?? Date.now(),
    changes: input.changes
  }
}
