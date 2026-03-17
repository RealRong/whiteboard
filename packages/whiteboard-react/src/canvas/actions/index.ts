export const closeAfter = (
  effect: Promise<unknown>,
  close?: () => void
) => {
  void effect.finally(() => {
    close?.()
  })
}

export * from './create'
export * from './node'
export * from './selection'
export * from './shortcut'
