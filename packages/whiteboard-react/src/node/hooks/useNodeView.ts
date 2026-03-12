import type { CSSProperties } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeDefinition, NodeRenderProps } from '../../types/node'
import { useInstance, useNode, useTool } from '../../common/hooks'
import { useSelectionContains } from '../../selection'
import {
  applyNodeDraft,
  useTransientNode,
  type NodeReader
} from '../../transient'
import { useNodeRegistry } from '../registry'
import {
  buildNodeConnectHandleOverlayStyle,
  buildNodeTransformStyle
} from '../components/styles'

export type NodeView = {
  nodeId: NodeId
  node: NodeRenderProps['node']
  rect: NodeRenderProps['rect']
  hovered: boolean
  selected: boolean
  rotation: number
  hasResizePreview: boolean
  shouldAutoMeasure: boolean
  canRotate: boolean
  shouldMountTransform: boolean
  shouldMountConnectHandles: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  connectHandleOverlayStyle: CSSProperties
  renderProps: NodeRenderProps
  definition?: NodeDefinition
}

export const useNodeView = (
  nodeId: NodeId,
  node: NodeReader
): NodeView | undefined => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const item = useNode(nodeId)
  const draft = useTransientNode(node, nodeId)
  const activeTool = useTool()
  const selected = useSelectionContains(nodeId)

  if (!item) return undefined

  const {
    node: resolvedNode,
    rect,
    hovered,
    hasResizePreview
  } = applyNodeDraft(item, draft)
  const rotation = typeof resolvedNode.rotation === 'number' ? resolvedNode.rotation : 0
  const definition = registry.get(resolvedNode.type)
  const shouldAutoMeasure = Boolean(definition?.autoMeasure) && !hasResizePreview
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : resolvedNode.type !== 'group'
  const shouldMountTransform = activeTool === 'select' && selected && !resolvedNode.locked
  const shouldMountConnectHandles = activeTool === 'edge' && (selected || hovered)
  const renderProps: NodeRenderProps = {
    read: instance.read,
    commands: instance.commands,
    node: resolvedNode,
    rect,
    selected,
    hovered
  }
  const nodeStyle = definition?.getStyle
    ? definition.getStyle(renderProps)
    : {}
  const transformStyle = buildNodeTransformStyle(rect, rotation, nodeStyle)

  return {
    nodeId,
    node: resolvedNode,
    rect,
    hovered,
    selected,
    rotation,
    hasResizePreview,
    shouldAutoMeasure,
    canRotate,
    shouldMountTransform,
    shouldMountConnectHandles,
    nodeStyle,
    transformStyle,
    connectHandleOverlayStyle: buildNodeConnectHandleOverlayStyle(transformStyle),
    renderProps,
    definition
  }
}
