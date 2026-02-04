import { useCallback, useEffect, useState } from 'react'
import { useInteractionActions } from '../../common/hooks/useInteractionActions'

export const useEdgeHover = () => {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | undefined>(undefined)
  const { updateInteraction } = useInteractionActions()

  useEffect(() => {
    updateInteraction({ hover: { edgeId: hoveredEdgeId } })
  }, [hoveredEdgeId, updateInteraction])

  const handleHoverChange = useCallback(
    (edgeId: string, hovered: boolean) => {
      setHoveredEdgeId((prev) => {
        if (hovered) return edgeId
        return prev === edgeId ? undefined : prev
      })
    },
    []
  )

  return { hoveredEdgeId, handleHoverChange }
}
