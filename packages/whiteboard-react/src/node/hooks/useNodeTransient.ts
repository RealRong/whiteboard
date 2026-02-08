import { useMemo } from 'react'
import { useInstance } from '../../common/hooks'
import type { NodeTransientApi } from 'types/node'


export const useNodeTransient = (): NodeTransientApi => {
  const instance = useInstance()

  return useMemo(
    () => ({
      setOverrides: instance.commands.transient.nodeOverrides.set,
      clearOverrides: instance.commands.transient.nodeOverrides.clear,
      commitOverrides: instance.commands.transient.nodeOverrides.commit
    }),
    [instance]
  )
}
