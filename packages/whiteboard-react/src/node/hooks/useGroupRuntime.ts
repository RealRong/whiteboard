import { useMemo } from 'react'
import { useInstance, useWhiteboardSelector } from '../../common/hooks'
import type { GroupRuntimeStore } from 'types/node'


export const useGroupRuntime = (): GroupRuntimeStore => {
  const instance = useInstance()
  const { nodeSize, node } = instance.runtime.config
  const nodes = useWhiteboardSelector('canvasNodes')
  const hoveredGroupId = useWhiteboardSelector('groupHovered')

  return useMemo<GroupRuntimeStore>(
    () => ({
      nodes,
      nodeSize,
      padding: node.groupPadding,
      hoveredGroupId,
      setHoveredGroupId: instance.commands.groupRuntime.setHoveredGroupId
    }),
    [hoveredGroupId, instance, node.groupPadding, nodeSize, nodes]
  )
}
