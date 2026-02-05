import type { Rect } from '@whiteboard/core'
import { useSelection } from './useSelection'

export const useSelectionOverlay = (override?: Rect) => {
  const selection = useSelection()
  if (override) return override
  if (selection.tool === 'edge') return undefined
  return selection.selectionRect
}
