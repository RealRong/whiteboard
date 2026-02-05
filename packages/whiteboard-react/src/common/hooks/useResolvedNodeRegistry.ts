import { useMemo } from 'react'
import type { NodeRegistry } from '../../node/registry'
import { createDefaultNodeRegistry } from '../../node/registry'

export const useResolvedNodeRegistry = (registry?: NodeRegistry) => {
  return useMemo(() => registry ?? createDefaultNodeRegistry(), [registry])
}
