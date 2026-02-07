import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import type { Guide } from '../utils/snap'
import { snapRuntimeDataAtom } from '../state/snapRuntimeAtom'
import { useDragGuides } from './useDragGuides'

export type SnapRuntime = ReturnType<typeof useSnapRuntime>

export const useSnapRuntime = () => {
  const data = useAtomValue(snapRuntimeDataAtom)
  const { setGuides } = useDragGuides()

  return useMemo(
    () => ({
      ...data,
      onGuidesChange: (guides: Guide[]) => setGuides(guides)
    }),
    [data, setGuides]
  )
}
