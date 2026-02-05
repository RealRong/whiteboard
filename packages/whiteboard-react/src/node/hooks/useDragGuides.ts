import { useAtom } from 'jotai'
import type { Guide } from '../utils/snap'
import { dragGuidesAtom } from '../state/dragGuidesAtom'

export const useDragGuides = () => {
  const [guides, setGuides] = useAtom(dragGuidesAtom)
  return { guides, setGuides }
}
