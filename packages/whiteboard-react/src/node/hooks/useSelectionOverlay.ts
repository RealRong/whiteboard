import type { Rect } from '@whiteboard/core'
import { useSelectionStore } from '../../common/hooks/useSelectionStore'

export const useSelectionOverlay = (override?: Rect) => {
  const selection = useSelectionStore()
  if (override) return override
  if (selection.tool === 'edge') return undefined
  return selection.selectionRect
}
