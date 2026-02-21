import type { Commands } from '@engine-types/commands'
import type { Actor as MindmapActor } from '../../runtime/actors/mindmap/Actor'

export const createMindmap = (
  mindmap: MindmapActor
): Pick<Commands, 'mindmap'> => ({
  mindmap: {
    create: mindmap.create,
    replace: mindmap.replace,
    delete: mindmap.delete,
    addChild: mindmap.addChild,
    addSibling: mindmap.addSibling,
    moveSubtree: mindmap.moveSubtree,
    removeSubtree: mindmap.removeSubtree,
    cloneSubtree: mindmap.cloneSubtree,
    toggleCollapse: mindmap.toggleCollapse,
    setNodeData: mindmap.setNodeData,
    reorderChild: mindmap.reorderChild,
    setSide: mindmap.setSide,
    attachExternal: mindmap.attachExternal,
    insertNode: mindmap.insertNode,
    moveSubtreeWithLayout: mindmap.moveSubtreeWithLayout,
    moveSubtreeWithDrop: mindmap.moveSubtreeWithDrop,
    moveRoot: mindmap.moveRoot
  }
})

