import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { hoveredEdgeIdAtom } from '../../common/state'

export const useEdgeHover = () => {
  const [hoveredEdgeId, setHoveredEdgeId] = useAtom(hoveredEdgeIdAtom)

  const handleHoverChange = useCallback(
    (edgeId: string, hovered: boolean) => {
      setHoveredEdgeId((prev) => {
        return hovered ? edgeId : prev === edgeId ? undefined : prev
      })
    },
    [setHoveredEdgeId]
  )

  return { hoveredEdgeId, handleHoverChange }
}
