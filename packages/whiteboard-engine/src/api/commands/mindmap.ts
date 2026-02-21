import {
  getSide,
  type MindmapNodeId
} from '@whiteboard/core'
import type { Command } from '@engine-types/command'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import { DEFAULT_TUNING } from '../../config'
import type { ApplyCommandChange } from './shared'

export const createMindmap = (
  instance: InternalInstance,
  applyChange: ApplyCommandChange
): Pick<Commands, 'mindmap'> => {
  const toLayoutHint = (
    anchorId: MindmapNodeId,
    nodeSize: { width: number; height: number },
    layout: MindmapLayoutConfig
  ) => ({
    nodeSize,
    mode: layout.mode,
    options: layout.options,
    anchorId
  })

  const resolveRootInsertSide = (
    placement: 'left' | 'right' | 'up' | 'down',
    layout: MindmapLayoutConfig
  ): 'left' | 'right' => {
    if (placement === 'left') return 'left'
    if (placement === 'right') return 'right'
    const layoutSide = layout.options?.side
    return layoutSide === 'left' || layoutSide === 'right'
      ? layoutSide
      : DEFAULT_TUNING.mindmap.defaultSide
  }

  const applyMindmapChange = (change: Command) => applyChange(change)

  const create: Commands['mindmap']['create'] = (payload) =>
    applyMindmapChange({
      type: 'mindmap.create',
      payload
    })

  const replace: Commands['mindmap']['replace'] = (id, tree) =>
    applyMindmapChange({
      type: 'mindmap.replace',
      id,
      tree
    })

  const remove: Commands['mindmap']['delete'] = (ids) =>
    applyMindmapChange({
      type: 'mindmap.delete',
      ids
    })

  const addChild: Commands['mindmap']['addChild'] = (id, parentId, payload, options) =>
    applyMindmapChange({
      type: 'mindmap.addChild',
      id,
      parentId,
      payload,
      options
    })

  const addSibling: Commands['mindmap']['addSibling'] = (id, nodeId, position, payload, options) =>
    applyMindmapChange({
      type: 'mindmap.addSibling',
      id,
      nodeId,
      position,
      payload,
      options
    })

  const moveSubtree: Commands['mindmap']['moveSubtree'] = (id, nodeId, newParentId, options) =>
    applyMindmapChange({
      type: 'mindmap.moveSubtree',
      id,
      nodeId,
      newParentId,
      options
    })

  const removeSubtree: Commands['mindmap']['removeSubtree'] = (id, nodeId) =>
    applyMindmapChange({
      type: 'mindmap.removeSubtree',
      id,
      nodeId
    })

  const cloneSubtree: Commands['mindmap']['cloneSubtree'] = (id, nodeId, options) =>
    applyMindmapChange({
      type: 'mindmap.cloneSubtree',
      id,
      nodeId,
      options
    })

  const toggleCollapse: Commands['mindmap']['toggleCollapse'] = (id, nodeId, collapsed) =>
    applyMindmapChange({
      type: 'mindmap.toggleCollapse',
      id,
      nodeId,
      collapsed
    })

  const setNodeData: Commands['mindmap']['setNodeData'] = (id, nodeId, patch) =>
    applyMindmapChange({
      type: 'mindmap.setNodeData',
      id,
      nodeId,
      patch
    })

  const reorderChild: Commands['mindmap']['reorderChild'] = (id, parentId, fromIndex, toIndex) =>
    applyMindmapChange({
      type: 'mindmap.reorderChild',
      id,
      parentId,
      fromIndex,
      toIndex
    })

  const setSide: Commands['mindmap']['setSide'] = (id, nodeId, side) =>
    applyMindmapChange({
      type: 'mindmap.setSide',
      id,
      nodeId,
      side
    })

  const attachExternal: Commands['mindmap']['attachExternal'] = (id, targetId, payload, options) =>
    applyMindmapChange({
      type: 'mindmap.attachExternal',
      id,
      targetId,
      payload,
      options
    })

  const insertNode: Commands['mindmap']['insertNode'] = async ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload = { kind: 'text', text: '' }
  }) => {
    const layoutHint = toLayoutHint(targetNodeId, nodeSize, layout)

    if (targetNodeId === tree.rootId) {
      const children = tree.children[targetNodeId] ?? []
      const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
      const side = resolveRootInsertSide(placement, layout)
      await addChild(id, targetNodeId, payload, { index, side, layout: layoutHint })
      return
    }

    if (placement === 'up' || placement === 'down') {
      await addSibling(id, targetNodeId, placement === 'up' ? 'before' : 'after', payload, {
        layout: layoutHint
      })
      return
    }

    const targetSide = getSide(tree, targetNodeId) ?? DEFAULT_TUNING.mindmap.defaultSide
    const towardRoot =
      (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

    if (towardRoot) {
      const result = await addSibling(id, targetNodeId, 'before', payload, {
        layout: layoutHint
      })
      if (!result.ok || !result.value) return
      await moveSubtree(id, targetNodeId, result.value as MindmapNodeId, {
        index: 0,
        layout: toLayoutHint(result.value as MindmapNodeId, nodeSize, layout)
      })
      return
    }

    await addChild(id, targetNodeId, payload, { layout: layoutHint })
  }

  const moveSubtreeWithLayout: Commands['mindmap']['moveSubtreeWithLayout'] = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }) =>
    moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: toLayoutHint(newParentId, nodeSize, layout)
    })

  const moveSubtreeWithDrop: Commands['mindmap']['moveSubtreeWithDrop'] = async ({
    id,
    nodeId,
    drop,
    origin,
    nodeSize,
    layout
  }) => {
    const shouldMove =
      drop.parentId !== origin?.parentId || drop.index !== origin?.index || typeof drop.side !== 'undefined'
    if (!shouldMove) return

    await moveSubtreeWithLayout({
      id,
      nodeId,
      newParentId: drop.parentId,
      index: drop.index,
      side: drop.side,
      nodeSize,
      layout
    })
  }

  const moveRoot: Commands['mindmap']['moveRoot'] = async ({
    nodeId,
    position,
    threshold = DEFAULT_TUNING.mindmap.rootMoveThreshold
  }) => {
    const node = instance.graph.read().canvasNodes.find((item) => item.id === nodeId)
    if (!node) return
    if (Math.abs(node.position.x - position.x) < threshold && Math.abs(node.position.y - position.y) < threshold) {
      return
    }

    await applyMindmapChange({
      type: 'node.update',
      id: nodeId,
      patch: {
        position: { x: position.x, y: position.y }
      }
    })
  }

  return {
    mindmap: {
      create,
      replace,
      delete: remove,
      addChild,
      addSibling,
      moveSubtree,
      removeSubtree,
      cloneSubtree,
      toggleCollapse,
      setNodeData,
      reorderChild,
      setSide,
      attachExternal,
      insertNode,
      moveSubtreeWithLayout,
      moveSubtreeWithDrop,
      moveRoot
    }
  }
}
