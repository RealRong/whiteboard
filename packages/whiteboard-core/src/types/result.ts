export type CoreFailure = {
  ok: false
  message: string
  code?: string
}

export type CoreResult<T extends object = {}> =
  | ({ ok: true } & T)
  | CoreFailure
