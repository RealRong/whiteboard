import { useMemo } from 'react'
import type { NodeSelectionView } from '../../features/node/selection'
import { resolveNodeSelectionView } from '../../features/node/selection'
import { resolveNodeMeta } from '../../features/node/registry'
import { useInternalInstance } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useSelection = (): NodeSelectionView => {
  const instance = useInternalInstance()
  const selection = useStoreValue(instance.read.selection)

  return useMemo(() => resolveNodeSelectionView(selection, {
    resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
  }), [instance, selection])
}
