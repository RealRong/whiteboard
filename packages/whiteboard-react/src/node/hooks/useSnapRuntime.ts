import { useMemo } from 'react'
import type { Guide } from 'types/node/snap'
import { dragGuidesAtom } from '../state/dragGuidesAtom'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { useInstance, useWhiteboardConfig, useWhiteboardSelector } from '../../common/hooks'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../utils/snap'
import { getNodeAABB } from '../../common/utils/geometry'
import type { SnapRuntime } from 'types/node'

const DEFAULT_THRESHOLD = 8

export const useSnapRuntime = (): SnapRuntime => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const tool = useWhiteboardSelector('tool')
  const nodes = useWhiteboardSelector('canvasNodes')

  const data = useMemo(() => {
    const enabled = tool === 'select'
    if (!nodes.length) {
      return {
        enabled,
        candidates: [],
        getCandidates: undefined,
        thresholdScreen: DEFAULT_THRESHOLD
      }
    }

    const snapCandidates = buildSnapCandidates(
      nodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, nodeSize)
      }))
    )
    const snapIndex = createGridIndex(snapCandidates, Math.max(240, DEFAULT_GROUP_PADDING * 6))
    const getCandidates = (rect: { x: number; y: number; width: number; height: number }) => queryGridIndex(snapIndex, rect)

    return {
      enabled,
      candidates: snapCandidates,
      getCandidates,
      thresholdScreen: DEFAULT_THRESHOLD
    }
  }, [nodeSize, nodes, tool])

  return useMemo(
    () => ({
      ...data,
      onGuidesChange: (guides: Guide[]) => instance.state.set(dragGuidesAtom, guides)
    }),
    [data, instance]
  )
}
