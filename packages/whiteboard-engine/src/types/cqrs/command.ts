export type CommandEnvelope<
  TType extends string = string,
  TPayload = unknown
> = {
  id: string
  type: TType
  payload: Readonly<TPayload>
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
