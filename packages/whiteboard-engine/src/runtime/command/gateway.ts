import type {
  CommandEnvelope,
  CommandGateway,
  CommandResult
} from '@engine-types/cqrs/command'
import type { WriteDomain, WriteInput } from '@engine-types/command/api'
import type { Apply } from '../write/stages/plan/draft'

type GatewayOptions = {
  apply: Apply
}

const toFailure = (
  commandId: string,
  code: string,
  message: string,
  detail?: unknown
): CommandResult => ({
  ok: false,
  commandId,
  error: {
    code,
    message,
    detail
  }
})

const isWriteInput = (value: unknown): value is WriteInput<WriteDomain> => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WriteInput<WriteDomain>>
  return Boolean(candidate.domain) && typeof candidate.command === 'object'
}

export const createCommandGateway = ({
  apply
}: GatewayOptions): CommandGateway => ({
  dispatch: async (command) => {
    if (command.type !== 'write.apply') {
      return toFailure(
        command.id,
        'unsupported_command',
        `Unsupported command type: ${command.type}`
      )
    }

    if (!isWriteInput(command.payload)) {
      return toFailure(
        command.id,
        'invalid_payload',
        'Invalid payload for write.apply command.'
      )
    }

    const payload = command.payload
    const result = await apply({
      ...payload,
      source: payload.source ?? command.meta.source,
      trace: {
        commandId: command.id,
        correlationId: command.meta.correlationId,
        transactionId: command.meta.transactionId,
        causationId: command.meta.causationId,
        timestamp: command.meta.timestamp
      }
    })

    if (!result.ok) {
      return toFailure(
        command.id,
        result.reason,
        result.message ?? 'Command execution failed.'
      )
    }

    return {
      ok: true,
      commandId: command.id,
      value: result
    }
  }
})

export type WriteApplyCommandEnvelope = CommandEnvelope<
  'write.apply',
  WriteInput<WriteDomain>
>
