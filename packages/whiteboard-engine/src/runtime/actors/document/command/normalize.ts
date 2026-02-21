import type { ApplyOptions, CommandBatch, CommandSource } from '@engine-types/command'
import type { DocumentId } from '@whiteboard/core'
import type { ValidatedCommandBatchInput } from './validate'

type NormalizeContext = {
  docId?: DocumentId
  source?: CommandSource
}

const createCommandBatchId = () => {
  const random = Math.random().toString(36).slice(2, 10)
  return `cs_${Date.now().toString(36)}_${random}`
}

export const normalizeCommandBatch = (
  input: ValidatedCommandBatchInput,
  options: ApplyOptions | undefined,
  context: NormalizeContext
): CommandBatch => {
  const meta = input.meta

  return {
    id: options?.id ?? meta?.id ?? createCommandBatchId(),
    docId: options?.docId ?? meta?.docId ?? context.docId,
    source: options?.source ?? meta?.source ?? context.source ?? 'system',
    actor: options?.actor ?? meta?.actor,
    timestamp: options?.timestamp ?? meta?.timestamp ?? Date.now(),
    commands: input.commands
  }
}
