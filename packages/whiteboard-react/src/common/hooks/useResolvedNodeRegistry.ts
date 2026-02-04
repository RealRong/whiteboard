import { useMemo } from 'react'
import type { NodeRegistry } from '../../node/registry/nodeRegistry'
import { createDefaultNodeRegistry } from '../../node/registry/defaultNodes'

export const useResolvedNodeRegistry = (registry?: NodeRegistry) => {
  return useMemo(() => registry ?? createDefaultNodeRegistry(), [registry])
}
