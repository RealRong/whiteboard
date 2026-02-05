import { useEffect } from 'react'
import type { Core, Node } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { getNodeAABB } from '../../common/utils/geometry'
import { expandGroupRect, getGroupDescendants, getNodesBoundingRect, rectEquals } from '../utils/group'

type Options = {
  core: Core
  nodes: Node[]
  nodeSize: Size
  padding?: number
}

export const useGroupAutoFit = ({ core, nodes, nodeSize, padding = 24 }: Options) => {
  useEffect(() => {
    if (!nodes.length) return
    nodes.forEach((group) => {
      if (group.type !== 'group') return
      const autoFit =
        group.data && typeof group.data.autoFit === 'string' ? group.data.autoFit : 'expand-only'
      if (autoFit === 'manual') return
      const groupPadding =
        group.data && typeof group.data.padding === 'number' ? group.data.padding : padding
      const children = getGroupDescendants(nodes, group.id)
      if (!children.length) return
      const contentRect = getNodesBoundingRect(children, nodeSize)
      if (!contentRect) return
      const groupRect = getNodeAABB(group, nodeSize)
      const expanded = expandGroupRect(groupRect, contentRect, groupPadding)
      if (!rectEquals(expanded, groupRect)) {
        core.dispatch({
          type: 'node.update',
          id: group.id,
          patch: {
            position: { x: expanded.x, y: expanded.y },
            size: { width: expanded.width, height: expanded.height }
          }
        })
      }
    })
  }, [core, nodeSize, nodes, padding])
}
