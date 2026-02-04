import { useAtom } from 'jotai'
import { useCallback } from 'react'
import type { Guide } from '../utils/snap'
import { dragGuidesAtom } from '../state/dragGuidesAtom'

export const useDragGuides = () => {
  const [guides, setGuides] = useAtom(dragGuidesAtom)
  const handleGuidesChange = useCallback(
    (next: Guide[]) => {
      setGuides(next)
    },
    [setGuides]
  )

  return { guides, setGuides: handleGuidesChange }
}
