import type { Apply } from '@engine-types/write'
import type { CommandSource, EngineCommands, WriteCommandMap } from '@engine-types/command'

type MindmapCommand = WriteCommandMap['mindmap']

export const mindmap = ({
  apply
}: {
  apply: Apply
}): EngineCommands['mindmap'] => {
  const run = (
    command: MindmapCommand,
    source: CommandSource = 'user'
  ) =>
    apply({
      domain: 'mindmap',
      command,
      source
    })

  return {
    create: (payload) =>
      run({
        type: 'create',
        payload
      }),
    replace: (id, tree) =>
      run({
        type: 'replace',
        id,
        tree
      }),
    delete: (ids) =>
      run({
        type: 'delete',
        ids
      }),
    addChild: (id, parentId, payload, options) =>
      run({
        type: 'insert.child',
        id,
        parentId,
        payload,
        options
      }),
    addSibling: (id, nodeId, position, payload, options) =>
      run({
        type: 'insert.sibling',
        id,
        nodeId,
        position,
        payload,
        options
      }),
    attachExternal: (id, targetId, payload, options) =>
      run({
        type: 'insert.external',
        id,
        targetId,
        payload,
        options
      }),
    insertPlacement: (options) =>
      run({
        type: 'insert.placement',
        ...options
      }),
    moveSubtree: (id, nodeId, newParentId, options) =>
      run({
        type: 'move.subtree',
        id,
        nodeId,
        newParentId,
        options
      }),
    moveLayout: (options) =>
      run({
        type: 'move.layout',
        ...options
      }),
    moveDrop: (options) =>
      run({
        type: 'move.drop',
        ...options
      }),
    reorderChild: (id, parentId, fromIndex, toIndex) =>
      run({
        type: 'move.reorder',
        id,
        parentId,
        fromIndex,
        toIndex
      }),
    moveRoot: (options) =>
      run({
        type: 'move.root',
        ...options
      }),
    removeSubtree: (id, nodeId) =>
      run({
        type: 'remove',
        id,
        nodeId
      }),
    cloneSubtree: (id, nodeId, options) =>
      run({
        type: 'clone.subtree',
        id,
        nodeId,
        options
      }),
    setNodeData: (id, nodeId, patch) =>
      run({
        type: 'update.data',
        id,
        nodeId,
        patch
      }),
    toggleCollapse: (id, nodeId, collapsed) =>
      run({
        type: 'update.collapse',
        id,
        nodeId,
        collapsed
      }),
    setSide: (id, nodeId, side) =>
      run({
        type: 'update.side',
        id,
        nodeId,
        side
      })
  }
}
