import type { RefObject } from 'react'
import { useEdgeConnect } from '../../../features/edge/hooks/connect/useEdgeConnect'

export const EdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  useEdgeConnect({
    containerRef
  })

  return null
}
