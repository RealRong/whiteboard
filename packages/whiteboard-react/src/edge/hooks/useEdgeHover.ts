import { useCallback, useState } from 'react'
import { useInteraction } from '../../common/hooks/useInteraction'

export const useEdgeHover = () => {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | undefined>(undefined)
  const { update: updateInteraction } = useInteraction()

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
