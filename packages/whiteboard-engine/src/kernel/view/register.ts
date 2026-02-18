import type {
  ViewKey,
  ViewSnapshot
} from '@engine-types/instance/view'
import type { StateKey } from '@engine-types/instance/state'

export type GraphDependencyKey =
  | 'graph.visibleNodes'
  | 'graph.canvasNodes'
  | 'graph.visibleEdges'

export type ViewDependencyKey = StateKey | GraphDependencyKey

export type ViewDerivation<K extends ViewKey> = {
  deps: ViewDependencyKey[]
  derive: () => ViewSnapshot[K]
}

export type ViewDerivationMap = {
  [K in ViewKey]: ViewDerivation<K>
}

const uniqueDependencies = (keys: readonly ViewDependencyKey[]) => Array.from(new Set(keys))

export const defineViewDerivation = <K extends ViewKey>(
  deps: readonly ViewDependencyKey[],
  derive: () => ViewSnapshot[K]
): ViewDerivation<K> => ({
  deps: uniqueDependencies(deps),
  derive
})
