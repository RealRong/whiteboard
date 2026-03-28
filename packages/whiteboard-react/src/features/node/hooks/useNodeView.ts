import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { NodeItem } from '@whiteboard/engine'
import type { NodeId } from '@whiteboard/core/types'
import type { InternalEditor } from '../../../runtime/instance'
import { useInternalInstance } from '../../../runtime/hooks'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import type { NodeDefinition, NodeRenderProps, NodeWrite } from '../../../types/node'

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

export type NodeView = {
  nodeId: NodeId
  node: NodeItem['node']
  rect: NodeItem['rect']
  frameRect: NodeItem['rect']
  rotation: number
  hidden: boolean
  hasResizePreview: boolean
  canConnect: boolean
  canResize: boolean
  canRotate: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  definition?: NodeDefinition
  renderProps: NodeRenderProps
}

export type NodeOverlayView = {
  nodeId: NodeView['nodeId']
  node: NodeView['node']
  rect: NodeView['rect']
  frameRect: NodeView['frameRect']
  rotation: NodeView['rotation']
  canConnect: NodeView['canConnect']
  canResize: NodeView['canResize']
  canRotate: NodeView['canRotate']
}

const EMPTY_NODE_INTERACTION: ReturnType<InternalEditor['read']['node']['interaction']['get']> = {
  hovered: false,
  hidden: false,
  hasPatch: false,
  hasResizePreview: false
}

const resolveNodeOverlayViewState = (
  instance: Pick<InternalEditor, 'registry' | 'read'>,
  nodeId: NodeId,
  item: NodeItem
): NodeOverlayView => {
  const node = item.node
  const rect = item.rect
  const frameRect = instance.read.node.frame(nodeId) ?? rect
  const rotation = node.type === 'group'
    ? 0
    : (typeof node.rotation === 'number' ? node.rotation : 0)
  const capability = instance.read.node.transform(node)

  return {
    nodeId,
    node,
    rect,
    frameRect,
    rotation,
    canConnect: instance.read.node.connect(node),
    canResize: capability.resize,
    canRotate: capability.rotate
  }
}

const resolveNodeViewState = (
  instance: Pick<InternalEditor, 'commands' | 'registry' | 'read'>,
  nodeId: NodeId,
  item: NodeItem,
  interaction: ReturnType<InternalEditor['read']['node']['interaction']['get']>,
  selected: boolean
): NodeView => {
  const resolvedNode = item.node
  const rect = item.rect
  const frameRect = instance.read.node.frame(nodeId) ?? rect
  const hidden = interaction.hidden
  const hasResizePreview = interaction.hasResizePreview
  const rotation = resolvedNode.type === 'group'
    ? 0
    : (typeof resolvedNode.rotation === 'number' ? resolvedNode.rotation : 0)
  const definition = instance.registry.get(resolvedNode.type)
  const write: NodeWrite = {
    update: (update) => {
      instance.commands.node.raw.update(nodeId, update)
    }
  }
  const renderProps: NodeRenderProps = {
    node: resolvedNode,
    rect,
    selected,
    hovered: interaction.hovered,
    write
  }
  const capability = instance.read.node.transform(resolvedNode)
  const nodeStyle = definition?.style
    ? definition.style(renderProps)
    : {}
  const transformStyle = buildNodeTransformStyle(rect, rotation, nodeStyle)

  return {
    nodeId,
    node: resolvedNode,
    rect,
    frameRect,
    rotation,
    hidden,
    hasResizePreview,
    canConnect: instance.read.node.connect(resolvedNode),
    canResize: capability.resize,
    canRotate: capability.rotate,
    nodeStyle,
    transformStyle,
    definition,
    renderProps
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
  const instance = useInternalInstance()
  const item = useOptionalKeyedStoreValue(
    instance.read.node.item,
    nodeId,
    undefined
  )
  const interaction = useOptionalKeyedStoreValue(
    instance.read.node.interaction,
    nodeId,
    EMPTY_NODE_INTERACTION
  )

  return useMemo(
    () => {
      if (!nodeId || !item) {
        return undefined
      }

      return resolveNodeViewState(instance, nodeId, item, interaction, selected)
    },
    [instance, interaction, item, nodeId, selected]
  )
}

export const useNodeOverlayView = (
  nodeId: NodeId | undefined
): NodeOverlayView | undefined => {
  const instance = useInternalInstance()
  const item = useOptionalKeyedStoreValue(
    instance.read.node.item,
    nodeId,
    undefined
  )

  return useMemo(
    () => {
      if (!nodeId || !item) {
        return undefined
      }

      return resolveNodeOverlayViewState(instance, nodeId, item)
    },
    [instance, item, nodeId]
  )
}
