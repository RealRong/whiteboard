import { useCallback, useMemo } from 'react'
import type { Node, Rect } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { getNodeAABB } from '../../common/utils/geometry'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../utils/snap'

export const useSnapIndex = (nodes: Node[], nodeSize: Size, gridSize = 240) => {
  const snapCandidates = useMemo(() => {
    return buildSnapCandidates(
      nodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, nodeSize)
      }))
    )
  }, [nodeSize, nodes])

  const snapIndex = useMemo(() => createGridIndex(snapCandidates, gridSize), [gridSize, snapCandidates])

  const getCandidates = useCallback(
    (rect: Rect) => queryGridIndex(snapIndex, rect),
    [snapIndex]
  )

  return { snapCandidates, snapIndex, getCandidates }
}
