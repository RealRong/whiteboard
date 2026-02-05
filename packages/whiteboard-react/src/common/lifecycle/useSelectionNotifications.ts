import { useEffect, useMemo } from 'react'
import type { NodeId } from '@whiteboard/core'

export const useSelectionNotifications = (
  selectedNodeIds: Set<NodeId>,
  onSelectionChange?: (ids: NodeId[]) => void
) => {
  const selectionIds = useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds])
  useEffect(() => {
    onSelectionChange?.(selectionIds)
  }, [onSelectionChange, selectionIds])
}
