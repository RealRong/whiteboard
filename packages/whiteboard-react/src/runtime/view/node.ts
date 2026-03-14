import type { CSSProperties } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import type { NodeDefinition } from '../../types/node'
import type { InternalWhiteboardInstance } from '../instance/types'
import { combineUnsubscribers } from './shared'
import type { KeyedView } from './types'
import {
  applyNodeDraft,
  type NodeDraft
} from '../draft'
import {
  buildNodeTransformStyle
} from '../../features/node/components/styles'

export type NodeView = {
  nodeId: NodeId
  node: NodeViewItem['node']
  rect: NodeViewItem['rect']
  hovered: boolean
  rotation: number
  hasResizePreview: boolean
  canRotate: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
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

  return resolveNodeViewState(instance, nodeId, {
    item,
    draft: instance.draft.node.get(nodeId)
  }, selected)
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

      return combineUnsubscribers([
        instance.read.node.subscribe(nodeId, listener),
        instance.draft.node.subscribe(nodeId, listener)
      ])
    }
  }
}
