export type QueryMethod = (...args: readonly unknown[]) => unknown

export type QueryFacade = Record<string, QueryMethod>

export type ReadFacade = {
  get: (key: string) => unknown
  subscribe: (keys: readonly string[], listener: () => void) => () => void
}
