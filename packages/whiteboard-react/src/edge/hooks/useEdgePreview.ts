import { useMemo } from 'react'
import type { Node, NodeId } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { getAnchorPoint, getNodeRect } from '../../common/utils/geometry'
import type { EdgeConnectState } from '../../common/state/whiteboardAtoms'

type Options = {
  state: EdgeConnectState
  nodeMap: Map<NodeId, Node>
  nodeSize: Size
}

export const useEdgePreview = ({ state, nodeMap, nodeSize }: Options) => {
  const previewFrom = useMemo(() => {
    const from = state.from
    if (!from) return undefined
    const node = nodeMap.get(from.nodeId)
    if (!node) return undefined
    const rect = getNodeRect(node, nodeSize)
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    return getAnchorPoint(rect, from.anchor, rotation)
  }, [nodeMap, nodeSize, state.from])

  const previewTo = useMemo(() => {
    const to = state.to
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const node = nodeMap.get(to.nodeId)
      if (!node) return to.pointWorld
      const rect = getNodeRect(node, nodeSize)
      const rotation = typeof node.rotation === 'number' ? node.rotation : 0
      return getAnchorPoint(rect, to.anchor, rotation)
    }
    return to.pointWorld
  }, [nodeMap, nodeSize, state.to])

  const hoverSnap = useMemo(() => {
    const hover = state.hover
    if (!hover) return undefined
    if (hover.nodeId && hover.anchor) {
      const node = nodeMap.get(hover.nodeId)
      if (!node) return hover.pointWorld
      const rect = getNodeRect(node, nodeSize)
      const rotation = typeof node.rotation === 'number' ? node.rotation : 0
      return getAnchorPoint(rect, hover.anchor, rotation)
    }
    return hover.pointWorld
  }, [nodeMap, nodeSize, state.hover])

  return { previewFrom, previewTo, hoverSnap }
}
