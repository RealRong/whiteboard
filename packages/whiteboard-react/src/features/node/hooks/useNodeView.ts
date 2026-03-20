import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { NodeItem } from '@whiteboard/core/read'
import type { NodeId, NodePatch } from '@whiteboard/core/types'
import type { InternalInstance } from '../../../runtime/instance'
import { useInternalInstance } from '../../../runtime/hooks'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import type { NodeDefinition, NodeRenderProps } from '../../../types/node'
import {
  useNodeSession,
  type NodeSession
} from '../session/node'
import { getNodeScene } from '../scene'

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
  hovered: boolean
  rotation: number
  hasResizePreview: boolean
  canResize: boolean
  canRotate: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  definition?: NodeDefinition
  update: (patch: NodePatch) => void
  updateData: (patch: Record<string, unknown>) => void
}

export type NodeOverlayView = {
  nodeId: NodeView['nodeId']
  node: NodeView['node']
  rect: NodeView['rect']
  rotation: NodeView['rotation']
  canResize: NodeView['canResize']
  canRotate: NodeView['canRotate']
}

const resolveCanResize = (
  definition?: NodeDefinition
) => definition?.canResize ?? true

const resolveCanRotate = (
  definition?: NodeDefinition
) => (
  typeof definition?.canRotate === 'boolean'
    ? definition.canRotate
    : getNodeScene(definition) !== 'container'
)

const resolveNodeOverlayViewState = (
  instance: Pick<InternalInstance, 'registry'>,
  nodeId: NodeId,
  item: NodeItem
): NodeOverlayView => {
  const node = item.node
  const rect = item.rect
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  const definition = instance.registry.get(node.type)
  const canResize = resolveCanResize(definition)
  const canRotate = resolveCanRotate(definition)

  return {
    nodeId,
    node,
    rect,
    rotation,
    canResize,
    canRotate
  }
}

const resolveNodeViewState = (
  instance: Pick<InternalInstance, 'commands' | 'registry'>,
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
  const update = (patch: NodePatch) => {
    instance.commands.node.update(nodeId, patch)
  }
  const updateData = (patch: Record<string, unknown>) => {
    instance.commands.node.updateData(nodeId, patch)
  }
  const renderProps: NodeRenderProps = {
    node: resolvedNode,
    rect,
    selected,
    hovered,
    update,
      updateData
  }
  const canResize = resolveCanResize(definition)
  const canRotate = resolveCanRotate(definition)
  const nodeStyle = definition?.style
    ? definition.style(renderProps)
    : {}
  const transformStyle = buildNodeTransformStyle(rect, rotation, nodeStyle)

  return {
    nodeId,
    node: resolvedNode,
    rect,
    hovered,
    rotation,
    hasResizePreview,
    canResize,
    canRotate,
    nodeStyle,
    transformStyle,
    definition,
    update,
    updateData
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
