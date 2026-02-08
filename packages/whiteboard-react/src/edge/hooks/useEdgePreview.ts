import { useMemo } from 'react'
import type { Node, NodeId } from '@whiteboard/core'
import { getAnchorPoint } from '../../common/utils/geometry'
import type { EdgeConnectState } from 'types/state'
import { useInstance } from '../../common/hooks'

type Options = {
  state: EdgeConnectState
  nodeMap: Map<NodeId, Node>
}

export const useEdgePreview = ({ state, nodeMap }: Options) => {
  const instance = useInstance()
  const previewFrom = useMemo(() => {
    const from = state.from
    if (!from) return undefined
    const entry = instance.query.getCanvasNodeRectById(from.nodeId)
    if (!entry) return undefined
    return getAnchorPoint(entry.rect, from.anchor, entry.rotation)
  }, [instance, nodeMap, state.from])

  const previewTo = useMemo(() => {
    const to = state.to
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const entry = instance.query.getCanvasNodeRectById(to.nodeId)
      if (!entry) return to.pointWorld
      return getAnchorPoint(entry.rect, to.anchor, entry.rotation)
    }
    return to.pointWorld
  }, [instance, nodeMap, state.to])

  const hoverSnap = useMemo(() => {
    const hover = state.hover
    if (!hover) return undefined
    if (hover.nodeId && hover.anchor) {
      const entry = instance.query.getCanvasNodeRectById(hover.nodeId)
      if (!entry) return hover.pointWorld
      return getAnchorPoint(entry.rect, hover.anchor, entry.rotation)
    }
    return hover.pointWorld
  }, [instance, nodeMap, state.hover])

  return { previewFrom, previewTo, hoverSnap }
}
