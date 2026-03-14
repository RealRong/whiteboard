import type { CSSProperties } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import type { NodeDefinition, NodeRenderProps } from '../../../types/node'
import type { InternalWhiteboardInstance } from '../types'
import type { KeyedView } from './types'
import {
  applyNodeDraft,
  type NodeDraft
} from '../../draft'
import {
  buildNodeTransformStyle
} from '../../../features/node/components/styles'

export type NodeView = {
  nodeId: NodeId
  node: NodeRenderProps['node']
  rect: NodeRenderProps['rect']
  hovered: boolean
  rotation: number
  hasResizePreview: boolean
  shouldAutoMeasure: boolean
  canRotate: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  renderProps: NodeRenderProps
  definition?: NodeDefinition
}

type NodeViewState = {
  item: NodeViewItem
  draft: NodeDraft
}

const resolveNodeViewState = (
  instance: Pick<InternalWhiteboardInstance, 'read' | 'commands' | 'registry'>,
  nodeId: NodeId,
  state: NodeViewState,
  selected: boolean
) => {
  const { item, draft } = state
  const {
    node: resolvedNode,
    rect,
    hovered,
    hasResizePreview
  } = applyNodeDraft(item, draft)
  const rotation = typeof resolvedNode.rotation === 'number' ? resolvedNode.rotation : 0
  const definition = instance.registry.get(resolvedNode.type)
  const shouldAutoMeasure = Boolean(definition?.autoMeasure) && !hasResizePreview
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : resolvedNode.type !== 'group'
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
    rotation,
    hasResizePreview,
    shouldAutoMeasure,
    canRotate,
    nodeStyle,
    transformStyle,
    renderProps,
    definition
  }
}

export const readNodeView = (
  instance: InternalWhiteboardInstance,
  nodeId: NodeId | undefined,
  {
    selected = false
  }: {
    selected?: boolean
  } = {}
): NodeView | undefined => {
  if (!nodeId) return undefined

  const item = instance.read.node.get(nodeId)
  if (!item) return undefined

  const view = resolveNodeViewState(instance, nodeId, {
    item,
    draft: instance.draft.node.get(nodeId)
  }, selected)

  return {
    nodeId: view.nodeId,
    node: view.node,
    rect: view.rect,
    hovered: view.hovered,
    rotation: view.rotation,
    hasResizePreview: view.hasResizePreview,
    shouldAutoMeasure: view.shouldAutoMeasure,
    canRotate: view.canRotate,
    nodeStyle: view.nodeStyle,
    transformStyle: view.transformStyle,
    renderProps: view.renderProps,
    definition: view.definition
  }
}

export const createNodeView = (
  getInstance: () => InternalWhiteboardInstance
): KeyedView<NodeId | undefined, NodeView | undefined, { selected?: boolean }> => {
  const cacheByNodeId = new Map<NodeId, {
    item: NodeViewItem
    draft: NodeDraft
    selected: boolean
    view: NodeView
  }>()

  return {
    get: (nodeId, options) => {
      const instance = getInstance()
      if (!nodeId) return undefined

      const item = instance.read.node.get(nodeId)
      if (!item) {
        cacheByNodeId.delete(nodeId)
        return undefined
      }

      const selected = options?.selected ?? false
      const draft = instance.draft.node.get(nodeId)
      const cached = cacheByNodeId.get(nodeId)
      if (
        cached
        && cached.item === item
        && cached.draft === draft
        && cached.selected === selected
      ) {
        return cached.view
      }

      const view = readNodeView(instance, nodeId, { selected })
      if (!view) {
        cacheByNodeId.delete(nodeId)
        return undefined
      }

      cacheByNodeId.set(nodeId, {
        item,
        draft,
        selected,
        view
      })
      return view
    },
    subscribe: (nodeId, listener) => {
      const instance = getInstance()
      if (!nodeId) return () => {}

      const unsubscribers = [
        instance.read.node.subscribe(nodeId, listener),
        instance.draft.node.subscribe(nodeId, listener)
      ]

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    }
  }
}
