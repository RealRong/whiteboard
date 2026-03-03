import type { CommandSource } from '../command/source'

export type CommandMeta = {
  source: CommandSource
  actorId?: string
  correlationId: string
  causationId?: string
  transactionId?: string
  timestamp: number
}

export type CommandEnvelope<
  TType extends string = string,
  TPayload = unknown
> = {
  id: string
  type: TType
  payload: Readonly<TPayload>
  meta: CommandMeta
}

export type CommandError = {
  code: string
  message: string
  detail?: unknown
}

export type CommandResult =
  | {
      ok: true
      commandId: string
      revision?: number
      value?: unknown
    }
  | {
      ok: false
      commandId: string
      error: CommandError
    }

export type CommandGateway = {
  dispatch: <TType extends string, TPayload>(
    command: CommandEnvelope<TType, TPayload>
  ) => Promise<CommandResult>
}
