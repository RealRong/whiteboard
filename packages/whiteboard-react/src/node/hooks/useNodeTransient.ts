import { useMemo } from 'react'
import { useInstance } from '../../common/hooks'
import type { NodeTransientApi } from 'types/node'


export const useNodeTransient = (): NodeTransientApi => {
  const instance = useInstance()

  return useMemo(
    () => ({
      setOverrides: instance.api.transient.nodeOverrides.set,
      clearOverrides: instance.api.transient.nodeOverrides.clear,
      commitOverrides: instance.api.transient.nodeOverrides.commit
    }),
    [instance]
  )
}
