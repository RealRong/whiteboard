import { useEffect } from 'react'

export const useEdgeSelectionNotifications = (
  selectedEdgeId?: string,
  onSelectionChange?: (id?: string) => void
) => {
  useEffect(() => {
    onSelectionChange?.(selectedEdgeId)
  }, [onSelectionChange, selectedEdgeId])
}
