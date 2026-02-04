import { useEffect } from 'react'
import type { EdgeId } from '@whiteboard/core'

export const useEdgeSelectionNotifications = (
  selectedEdgeId: EdgeId | undefined,
  onEdgeSelectionChange?: (id?: EdgeId) => void
) => {
  useEffect(() => {
    onEdgeSelectionChange?.(selectedEdgeId)
  }, [onEdgeSelectionChange, selectedEdgeId])
}
