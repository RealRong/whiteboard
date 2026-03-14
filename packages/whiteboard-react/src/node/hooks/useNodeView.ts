import type { CSSProperties } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import {
  useInternalInstance as useInstance,
  useKeyedViewArgs
} from '../../common/hooks'
import type { NodeView } from '../../common/instance/view/node'
import {
  buildNodeConnectHandleOverlayStyle
} from '../components/styles'

export type NodeOverlayView = {
  nodeId: NodeView['nodeId']
  node: NodeView['node']
  rect: NodeView['rect']
  hovered: NodeView['hovered']
  rotation: NodeView['rotation']
  canRotate: NodeView['canRotate']
  connectHandleOverlayStyle: CSSProperties
}

export const useNodeView = (
  nodeId: NodeId | undefined,
  {
    selected = false
  }: {
    selected?: boolean
  } = {}
): NodeView | undefined => {
  const instance = useInstance()
  return useKeyedViewArgs(instance.view.node, nodeId, { selected })
}

export const useNodeOverlayView = (
  nodeId: NodeId,
  {
    selected
  }: {
    selected: boolean
  }
): NodeOverlayView | undefined => {
  const view = useNodeView(nodeId, { selected })
  if (!view) return undefined

  return {
    nodeId: view.nodeId,
    node: view.node,
    rect: view.rect,
    hovered: view.hovered,
    rotation: view.rotation,
    canRotate: view.canRotate,
    connectHandleOverlayStyle: buildNodeConnectHandleOverlayStyle(view.transformStyle)
  }
}
