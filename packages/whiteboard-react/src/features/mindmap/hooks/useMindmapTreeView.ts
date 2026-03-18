import { useCallback, useMemo } from 'react'
import type { MindmapNodeId, NodeId, Rect } from '@whiteboard/core/types'
import { useInternalInstance } from '../../../runtime/hooks'
import { useKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import { useMindmapDragSession } from '../session/drag'

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
  ) => void
}

export const useMindmapTreeView = (
  treeId: NodeId
): MindmapTreeViewData | undefined => {
  const instance = useInternalInstance()
  const treeView = useKeyedStoreValue(instance.read.mindmap.item, treeId)
  const drag = useMindmapDragSession(instance.internals.mindmap.drag)
  const tree = treeView?.tree
  const root = treeView?.node
  const layout = treeView?.layout
  const nodeSize = instance.config.mindmapNodeSize

  const onAddChild = useCallback(
    (nodeId: MindmapNodeId, placement: 'left' | 'right' | 'up' | 'down') => {
      if (!tree || !root || !layout) {
        return
      }

      instance.commands.mindmap.insertPlacement({
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

  return useMemo(
    () => {
      if (!treeView || !root) {
        return undefined
      }

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
    },
    [drag, onAddChild, root, treeId, treeView]
  )
}
