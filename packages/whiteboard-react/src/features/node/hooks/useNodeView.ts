import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { NodeItem } from '@whiteboard/core/read'
import type { NodeId } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'
import {
  useInternalInstance as useInstance,
  useOptionalKeyedStoreValue
} from '../../../runtime/hooks'
import type { NodeDefinition } from '../../../types/node'
import {
  useNodeSession,
  type NodeSession
} from '../session'

const buildNodeTransformStyle = (
  rect: NodeItem['rect'],
  rotation: number,
  nodeStyle: CSSProperties
): CSSProperties => {
  const extraTransform = nodeStyle.transform
  const baseTransform = `translate(${rect.x}px, ${rect.y}px)`
  const rotationTransform = rotation !== 0 ? `rotate(${rotation}deg)` : undefined
  const transform = [baseTransform, extraTransform, rotationTransform]
    .filter(Boolean)
    .join(' ')

  return {
    transform: transform || undefined,
    transformOrigin: rotationTransform ? 'center center' : nodeStyle.transformOrigin
  }
}

const buildNodeConnectHandleOverlayStyle = (
  transformStyle: CSSProperties
): CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
  ...transformStyle
})

export type NodeView = {
  nodeId: NodeId
  node: NodeItem['node']
  rect: NodeItem['rect']
  hovered: boolean
  rotation: number
  hasResizePreview: boolean
  canRotate: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  definition?: NodeDefinition
}

export type NodeOverlayView = {
  nodeId: NodeView['nodeId']
  node: NodeView['node']
  rect: NodeView['rect']
  hovered: NodeView['hovered']
  rotation: NodeView['rotation']
  canRotate: NodeView['canRotate']
  connectHandleOverlayStyle: CSSProperties
}

const resolveNodeViewState = (
  instance: Pick<InternalWhiteboardInstance, 'read' | 'commands' | 'registry'>,
  nodeId: NodeId,
  item: NodeItem,
  session: NodeSession,
  selected: boolean
): NodeView => {
  const resolvedNode = item.node
  const rect = item.rect
  const hovered = session.hovered
  const hasResizePreview = Boolean(session.patch?.size)
  const rotation = typeof resolvedNode.rotation === 'number' ? resolvedNode.rotation : 0
  const definition = instance.registry.get(resolvedNode.type)
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : resolvedNode.type !== 'group'
  const nodeStyle = definition?.getStyle
    ? definition.getStyle({
      read: instance.read,
      commands: instance.commands,
      node: resolvedNode,
      rect,
      selected,
      hovered
    })
    : {}
  const transformStyle = buildNodeTransformStyle(rect, rotation, nodeStyle)

  return {
    nodeId,
    node: resolvedNode,
    rect,
    hovered,
    rotation,
    hasResizePreview,
    canRotate,
    nodeStyle,
    transformStyle,
    definition
  }
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
  const item = useOptionalKeyedStoreValue(
    instance.read.node.item,
    nodeId,
    undefined
  )
  const session = useNodeSession(instance.internals.node.session, nodeId)

  return useMemo(
    () => {
      if (!nodeId || !item) {
        return undefined
      }

      return resolveNodeViewState(instance, nodeId, item, session, selected)
    },
    [instance, item, nodeId, selected, session]
  )
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

  return useMemo(
    () => {
      if (!view) {
        return undefined
      }

      return {
        nodeId: view.nodeId,
        node: view.node,
        rect: view.rect,
        hovered: view.hovered,
        rotation: view.rotation,
        canRotate: view.canRotate,
        connectHandleOverlayStyle: buildNodeConnectHandleOverlayStyle(view.transformStyle)
      }
    },
    [view]
  )
}
