import type { CSSProperties } from 'react'
import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import {
  applyNodeDraft,
  type NodeDraft
} from '../../../runtime/draft'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'
import {
  useInternalInstance as useInstance
} from '../../../runtime/hooks'
import type { NodeDefinition } from '../../../types/node'
import {
  buildNodeConnectHandleOverlayStyle,
  buildNodeTransformStyle
} from '../components/styles'

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

export type NodeOverlayView = {
  nodeId: NodeView['nodeId']
  node: NodeView['node']
  rect: NodeView['rect']
  hovered: NodeView['hovered']
  rotation: NodeView['rotation']
  canRotate: NodeView['canRotate']
  connectHandleOverlayStyle: CSSProperties
}

type NodeViewState = {
  item: NodeViewItem
  draft: NodeDraft
}

type NodeViewCacheEntry = {
  nodeId: NodeId
  item: NodeViewItem
  draft: NodeDraft
  selected: boolean
  view: NodeView
}

const EMPTY_UNSUBSCRIBE = () => {}

const resolveNodeViewState = (
  instance: Pick<InternalWhiteboardInstance, 'read' | 'commands' | 'registry'>,
  nodeId: NodeId,
  state: NodeViewState,
  selected: boolean
): NodeView => {
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

export const useNodeView = (
  nodeId: NodeId | undefined,
  {
    selected = false
  }: {
    selected?: boolean
  } = {}
): NodeView | undefined => {
  const instance = useInstance()
  const cacheRef = useRef<NodeViewCacheEntry | null>(null)

  const subscribe = useMemo(
    () => {
      if (!nodeId) {
        return () => EMPTY_UNSUBSCRIBE
      }

      return (listener: () => void) => {
        const unsubscribeNode = instance.read.node.byId.subscribe(nodeId, listener)
        const unsubscribeDraft = instance.draft.node.subscribe(nodeId, listener)

        return () => {
          unsubscribeNode()
          unsubscribeDraft()
        }
      }
    },
    [instance, nodeId]
  )

  const getSnapshot = useMemo(
    () => () => {
      if (!nodeId) {
        cacheRef.current = null
        return undefined
      }

      const item = instance.read.node.byId.get(nodeId)
      if (!item) {
        cacheRef.current = null
        return undefined
      }

      const draft = instance.draft.node.get(nodeId)
      const cached = cacheRef.current

      if (
        cached
        && cached.nodeId === nodeId
        && cached.item === item
        && cached.draft === draft
        && cached.selected === selected
      ) {
        return cached.view
      }

      const view = resolveNodeViewState(instance, nodeId, {
        item,
        draft
      }, selected)

      cacheRef.current = {
        nodeId,
        item,
        draft,
        selected,
        view
      }

      return view
    },
    [instance, nodeId, selected]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
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
