import { useMemo } from 'react'
import type { NodeSelectionView } from '../../features/node/selection'
import { resolveNodeSelectionView } from '../../features/node/selection'
import { useInternalInstance } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useSelection = (): NodeSelectionView => {
  const instance = useInternalInstance()
  const selection = useStoreValue(instance.read.selection)

  return useMemo(() => resolveNodeSelectionView(selection, {
    resolveMeta: (type) => instance.registry.get(type)?.meta
  }), [instance, selection])
}
