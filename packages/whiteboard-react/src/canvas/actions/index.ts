const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object'
  && value !== null
  && 'then' in value
  && typeof (value as PromiseLike<unknown> & { then?: unknown }).then === 'function'

export const closeAfter = (
  effect: unknown,
  close?: () => void
) => {
  if (!isPromiseLike(effect)) {
    close?.()
    return
  }

  void Promise.resolve(effect).finally(() => {
    close?.()
  })
}

export * from './create'
export * from './shortcut'
