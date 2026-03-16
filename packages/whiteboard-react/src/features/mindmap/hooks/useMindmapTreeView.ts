import { useCallback } from 'react'
import type { MindmapNodeId, NodeId, Rect } from '@whiteboard/core/types'
import { useInstance } from '../../../runtime/hooks'
import type { MindmapDragDraft } from '../../../runtime/draft'
import { useKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'

type MindmapLineView = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapNodeView = {
  id: MindmapNodeId
  rect: Rect
  label: string
  dragActive: boolean
  attachTarget: boolean
  showActions: boolean
  dragPreviewActive: boolean
}

export type MindmapTreeViewData = {
  treeId: NodeId
  baseOffset: {
    x: number
    y: number
  }
  bbox: {
    width: number
    height: number
  }
  shiftX: number
  shiftY: number
  lines: readonly MindmapLineView[]
  nodes: readonly MindmapNodeView[]
  ghost?: {
    width: number
    height: number
    x: number
    y: number
  }
  connectionLine?: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  insertLine?: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  onAddChild: (
    nodeId: MindmapNodeId,
    placement: 'left' | 'right' | 'up' | 'down'
  ) => Promise<void>
}

export const useMindmapTreeView = (
  treeId: NodeId,
  drag?: MindmapDragDraft
): MindmapTreeViewData | undefined => {
  const instance = useInstance()
  const treeView = useKeyedStoreValue(instance.read.mindmap.item, treeId)
  const tree = treeView?.tree
  const root = treeView?.node
  const layout = treeView?.layout
  const nodeSize = instance.config.mindmapNodeSize

  const onAddChild = useCallback(
    async (nodeId: MindmapNodeId, placement: 'left' | 'right' | 'up' | 'down') => {
      if (!tree || !root || !layout) return
      await instance.commands.mindmap.insertPlacement({
        id: root.id,
        tree,
        targetNodeId: nodeId,
        placement,
        nodeSize,
        layout,
        payload: { kind: 'text', text: '' }
      })
    },
    [instance.commands.mindmap, layout, nodeSize, root?.id, tree]
  )

  if (!treeView || !root) return undefined

  const { computed, shiftX, shiftY, lines, labels } = treeView
  const dragPreview = drag?.treeId === treeId ? drag.preview : undefined
  const baseOffset = drag?.treeId === treeId ? drag.baseOffset : root.position

  const nodes = Object.entries(computed.node).map(([id, rect]) => ({
    id,
    rect,
    label: labels[id] ?? 'mindmap',
    dragActive: dragPreview?.nodeId === id,
    attachTarget: dragPreview?.drop?.type === 'attach' && dragPreview.drop.targetId === id,
    showActions: !dragPreview,
    dragPreviewActive: Boolean(dragPreview)
  }))

  return {
    treeId,
    baseOffset,
    bbox: computed.bbox,
    shiftX,
    shiftY,
    lines,
    nodes,
    ghost: dragPreview?.ghost,
    connectionLine: dragPreview?.drop?.connectionLine,
    insertLine: dragPreview?.drop?.insertLine,
    onAddChild
  }
}
