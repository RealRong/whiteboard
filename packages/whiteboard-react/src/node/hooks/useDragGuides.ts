import { useMemo } from 'react'
import type { Guide } from 'types/node/snap'
import { dragGuidesAtom } from '../state/dragGuidesAtom'
import { useInstance, useInstanceAtomValue } from '../../common/hooks'

export const useDragGuides = () => {
  const instance = useInstance()
  const guides = useInstanceAtomValue(dragGuidesAtom)

  return useMemo(
    () => ({
      guides,
      setGuides: (nextGuides: Guide[]) => instance.api.transient.dragGuides.set(nextGuides)
    }),
    [guides, instance]
  )
}
