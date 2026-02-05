import { useCallback, useState } from 'react'
import { useInteractionActions } from '../../common/hooks/useInteractionActions'

export const useEdgeHover = () => {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | undefined>(undefined)
  const { updateInteraction } = useInteractionActions()

  const handleHoverChange = useCallback(
    (edgeId: string, hovered: boolean) => {
      setHoveredEdgeId((prev) => {
        const next = hovered ? edgeId : prev === edgeId ? undefined : prev
        updateInteraction({ hover: { edgeId: next } })
        return next
      })
    },
    [updateInteraction]
  )

  return { hoveredEdgeId, handleHoverChange }
}
