import { useMemo } from 'react'
import type { Guide } from 'types/node/snap'
import { snapRuntimeDataAtom } from '../state/snapRuntimeAtom'
import { dragGuidesAtom } from '../state/dragGuidesAtom'
import { useInstance, useInstanceAtomValue } from '../../common/hooks'
import type { SnapRuntime } from 'types/node'

export const useSnapRuntime = (): SnapRuntime => {
  const instance = useInstance()
  const data = useInstanceAtomValue(snapRuntimeDataAtom)

  return useMemo(
    () => ({
      ...data,
      onGuidesChange: (guides: Guide[]) => instance.state.set(dragGuidesAtom, guides)
    }),
    [data, instance]
  )
}
