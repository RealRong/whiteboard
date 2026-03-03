import type {
  WriteDomain,
  WriteInput
} from '@engine-types/command/api'
import type { CommandGateway } from '@engine-types/cqrs/command'
import type { WriteCommandsApi } from '@engine-types/write/commands'
import type { DispatchResult } from '@whiteboard/core/types'
import { createBatchId } from '../shared/identifiers'

export const write = ({
  gateway
}: {
  gateway: CommandGateway
}): WriteCommandsApi => {
  const now = () => Date.now()

  return {
    apply: async <D extends WriteDomain>(payload: WriteInput<D>) => {
      const source = payload.source ?? 'ui'
      const commandId = payload.trace?.commandId ?? createBatchId('command')
      const commandResult = await gateway.dispatch<'write.apply', WriteInput<D>>({
        id: commandId,
        type: 'write.apply',
        payload,
        meta: {
          source,
          actorId: undefined,
          correlationId: payload.trace?.correlationId ?? commandId,
          causationId: payload.trace?.causationId,
          transactionId: payload.trace?.transactionId,
          timestamp: payload.trace?.timestamp ?? now()
        }
      })

      if (!commandResult.ok) {
        return {
          ok: false,
          reason: 'invalid',
          message: `[${commandResult.error.code}] ${commandResult.error.message}`
        }
      }

      const raw = commandResult.value
      if (
        raw &&
        typeof raw === 'object' &&
        'ok' in raw &&
        typeof (raw as DispatchResult).ok === 'boolean'
      ) {
        return raw as DispatchResult
      }

      return {
        ok: false,
        reason: 'invalid',
        message: '[invalid_gateway_result] Gateway returned an invalid dispatch result.'
      }
    }
  }
}
