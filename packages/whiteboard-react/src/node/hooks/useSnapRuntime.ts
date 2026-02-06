import { useMemo } from 'react'
import { useSetAtom } from 'jotai'
import type { Node } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { snapRuntimeAtom } from '../state/snapRuntimeAtom'
import { useDragGuides } from './useDragGuides'
import { useSnapIndex } from './useSnapIndex'

type Options = {
  nodes: Node[]
  nodeSize: Size
  enabled: boolean
  zoom: number
  thresholdScreen?: number
}

export const useSnapRuntime = ({ nodes, nodeSize, enabled, zoom, thresholdScreen = 8 }: Options) => {
  const { snapCandidates, getCandidates } = useSnapIndex(nodes, nodeSize)
  const { setGuides } = useDragGuides()
  const setRuntime = useSetAtom(snapRuntimeAtom)

  const runtime = useMemo(
    () => ({
      enabled,
      candidates: snapCandidates,
      getCandidates,
      thresholdScreen,
      zoom,
      onGuidesChange: setGuides
    }),
    [enabled, getCandidates, setGuides, snapCandidates, thresholdScreen, zoom]
  )

  return {
    runtime,
    setRuntime
  }
}
