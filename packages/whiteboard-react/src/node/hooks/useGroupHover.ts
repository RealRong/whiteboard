import { useCallback, useState } from 'react'
import type { NodeId } from '@whiteboard/core'

export const useGroupHover = (initial?: NodeId) => {
  const [hoverGroupId, setHoverGroupId] = useState<NodeId | undefined>(initial)
  const handleHoverGroupChange = useCallback((groupId?: NodeId) => {
    setHoverGroupId(groupId)
  }, [])

  return {
    hoverGroupId,
    handleHoverGroupChange
  }
}
