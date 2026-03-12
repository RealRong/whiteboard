import type { Rect } from '@whiteboard/core/types'
import { useTool } from '../common/hooks'
import {
  type SelectionReader,
  useTransientSelection,
} from '../transient'

export const useSelectionBoxView = (
  selection: SelectionReader
): Rect | undefined => {
  const tool = useTool()
  const rect = useTransientSelection(selection)

  if (!rect || tool === 'edge') {
    return undefined
  }

  return rect
}
