import { useMemo } from 'react'
import type { EdgeConnectState } from 'types/state'
import { useInstance } from '../../common/hooks'

type Options = {
  state: EdgeConnectState
}

export const useEdgePreview = ({ state }: Options) => {
  const instance = useInstance()

  const previewFrom = useMemo(() => {
    return instance.query.getEdgeConnectFromPoint(state.from)
  }, [instance, state.from])

  const previewTo = useMemo(() => {
    return instance.query.getEdgeConnectToPoint(state.to)
  }, [instance, state.to])

  const hoverSnap = useMemo(() => {
    return instance.query.getEdgeConnectToPoint(state.hover)
  }, [instance, state.hover])

  return { previewFrom, previewTo, hoverSnap }
}
