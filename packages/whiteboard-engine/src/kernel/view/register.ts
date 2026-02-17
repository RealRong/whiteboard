import type {
  StateKey,
  ViewKey,
  ViewSnapshot
} from '@engine-types/instance'

export type ViewDerivation<K extends ViewKey> = {
  deps: StateKey[]
  derive: () => ViewSnapshot[K]
}

export type ViewDerivationMap = {
  [K in ViewKey]: ViewDerivation<K>
}

const uniqueStateKeys = (keys: readonly StateKey[]) => Array.from(new Set(keys))

export const defineViewDerivation = <K extends ViewKey>(
  deps: readonly StateKey[],
  derive: () => ViewSnapshot[K]
): ViewDerivation<K> => ({
  deps: uniqueStateKeys(deps),
  derive
})
