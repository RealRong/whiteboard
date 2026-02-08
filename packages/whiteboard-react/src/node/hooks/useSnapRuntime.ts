import { useMemo } from 'react'
import type { Guide } from 'types/node/snap'
import { snapRuntimeDataAtom } from '../state/snapRuntimeAtom'
import { useDragGuides } from './useDragGuides'
import { useInstanceAtomValue } from '../../common/hooks'
import type { SnapRuntime } from 'types/node'

export const useSnapRuntime = (): SnapRuntime => {
  const data = useInstanceAtomValue(snapRuntimeDataAtom)
  const { setGuides } = useDragGuides()

  return useMemo(
    () => ({
      ...data,
      onGuidesChange: (guides: Guide[]) => setGuides(guides)
    }),
    [data, setGuides]
  )
}
