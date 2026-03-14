import type { RefObject } from 'react'
import { useTransientReset } from '../common/hooks'
import { useEdgeConnect } from '../edge/hooks/connect/useEdgeConnect'

export const EdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const { cancelConnectSession } = useEdgeConnect({
    containerRef
  })

  useTransientReset(cancelConnectSession)

  return null
}
