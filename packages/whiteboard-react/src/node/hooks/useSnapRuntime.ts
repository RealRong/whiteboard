import { useMemo } from 'react'
import { useInstance, useWhiteboardSelector } from '../../common/hooks'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../utils/snap'
import { getNodeAABB } from '../../common/utils/geometry'
import type { SnapRuntime } from 'types/node'

export const useSnapRuntime = (): SnapRuntime => {
  const instance = useInstance()
  const { nodeSize, node: nodeConfig } = instance.runtime.config
  const tool = useWhiteboardSelector('tool')
  const nodes = useWhiteboardSelector('canvasNodes')

  const data = useMemo(() => {
    const enabled = tool === 'select'
    if (!nodes.length) {
      return {
        enabled,
        candidates: [],
        getCandidates: undefined,
        thresholdScreen: nodeConfig.snapThresholdScreen
      }
    }

    const snapCandidates = buildSnapCandidates(
      nodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, nodeSize)
      }))
    )
    const snapIndex = createGridIndex(
      snapCandidates,
      Math.max(nodeConfig.snapGridCellSize, nodeConfig.groupPadding * 6)
    )
    const getCandidates = (rect: { x: number; y: number; width: number; height: number }) => queryGridIndex(snapIndex, rect)

    return {
      enabled,
      candidates: snapCandidates,
      getCandidates,
      thresholdScreen: nodeConfig.snapThresholdScreen
    }
  }, [nodeConfig.groupPadding, nodeConfig.snapGridCellSize, nodeConfig.snapThresholdScreen, nodeSize, nodes, tool])

  return useMemo(
    () => ({
      ...data,
      onGuidesChange: instance.commands.transient.dragGuides.set
    }),
    [data, instance]
  )
}
