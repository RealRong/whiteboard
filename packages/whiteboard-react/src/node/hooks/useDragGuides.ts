import { useCallback, useState } from 'react'
import type { Guide } from '../utils/snap'

export const useDragGuides = () => {
  const [guides, setGuides] = useState<Guide[]>([])
  const handleGuidesChange = useCallback((next: Guide[]) => {
    setGuides(next)
  }, [])

  return { guides, handleGuidesChange }
}
