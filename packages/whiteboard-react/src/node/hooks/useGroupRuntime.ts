import { useMemo } from 'react'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { useInstance, useWhiteboardConfig, useWhiteboardSelector } from '../../common/hooks'
import type { GroupRuntimeStore } from 'types/node'


export const useGroupRuntime = (): GroupRuntimeStore => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const nodes = useWhiteboardSelector('canvasNodes')
  const hoveredGroupId = useWhiteboardSelector('groupHovered')

  return useMemo<GroupRuntimeStore>(
    () => ({
      nodes,
      nodeSize,
      padding: DEFAULT_GROUP_PADDING,
      hoveredGroupId,
      setHoveredGroupId: instance.commands.groupRuntime.setHoveredGroupId
    }),
    [hoveredGroupId, instance, nodeSize, nodes]
  )
}
