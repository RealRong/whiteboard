import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapTree } from '@whiteboard/core/types'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  attachExternal as attachMindmapExternal,
  cloneSubtree as cloneMindmapSubtree,
  createMindmap,
  moveSubtree as moveMindmapSubtree,
  removeSubtree as removeMindmapSubtree,
  reorderChild as reorderMindmapChild,
  setNodeData as setMindmapNodeData,
  setSide as setMindmapSide,
  toggleCollapse as toggleMindmapCollapse
} from '@whiteboard/core/mindmap'
import type { MindmapHelpers } from './helpers'

type MindmapInstance = Pick<InternalInstance, 'document' | 'mutate'>

type BaseMindmapCommands = Pick<
  Commands['mindmap'],
  | 'create'
  | 'replace'
  | 'delete'
  | 'addChild'
  | 'addSibling'
  | 'moveSubtree'
  | 'removeSubtree'
  | 'cloneSubtree'
  | 'toggleCollapse'
  | 'setNodeData'
  | 'reorderChild'
  | 'setSide'
  | 'attachExternal'
>

type CreateBaseMindmapCommandsOptions = {
  instance: MindmapInstance
  helpers: MindmapHelpers
}

export const createBaseMindmapCommands = ({
  instance,
  helpers
}: CreateBaseMindmapCommandsOptions): BaseMindmapCommands => {
  const {
    createInvalidResult,
    readMindmap,
    createMindmapId,
    createMindmapNodeId,
    cloneTree,
    runMutationsWithValue,
    createReplaceOperations
  } = helpers

  const create: Commands['mindmap']['create'] = (payload) => {
    if (payload?.id && readMindmap(payload.id)) {
      return Promise.resolve(createInvalidResult(`Mindmap ${payload.id} already exists.`))
    }
    const mindmap = createMindmap({
      id: payload?.id ?? createMindmapId(),
      rootId: payload?.rootId,
      rootData: payload?.rootData,
      idGenerator: {
        treeId: createMindmapId,
        nodeId: createMindmapNodeId
      }
    })
    return runMutationsWithValue(
      [{ type: 'mindmap.create', mindmap }],
      mindmap.id
    )
  }

  const replace: Commands['mindmap']['replace'] = (id, tree) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }
    if (tree.id !== id) {
      return Promise.resolve(createInvalidResult('Mindmap id mismatch.'))
    }
    return instance.mutate(
      [{
        type: 'mindmap.replace',
        id,
        before: cloneTree(current),
        after: cloneTree(tree)
      }],
      'ui'
    )
  }

  const remove: Commands['mindmap']['delete'] = (ids) => {
    if (!ids.length) {
      return Promise.resolve(createInvalidResult('No mindmap ids provided.'))
    }

    const trees: MindmapTree[] = []
    for (const id of ids) {
      const tree = readMindmap(id)
      if (!tree) {
        return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
      }
      trees.push(tree)
    }

    return instance.mutate(
      trees.map((tree) => ({
        type: 'mindmap.delete' as const,
        id: tree.id,
        before: cloneTree(tree)
      })),
      'ui'
    )
  }

  const addChild: Commands['mindmap']['addChild'] = (id, parentId, payload, options) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = addMindmapChild(current, parentId, payload, {
      index: options?.index,
      side: options?.side,
      idGenerator: {
        nodeId: createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    const operations = createReplaceOperations(id, current, next.tree, options?.layout)
    return runMutationsWithValue(operations, next.value?.id)
  }

  const addSibling: Commands['mindmap']['addSibling'] = (id, nodeId, position, payload, options) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = addMindmapSibling(current, nodeId, position, payload, {
      idGenerator: {
        nodeId: createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    const operations = createReplaceOperations(id, current, next.tree, options?.layout)
    return runMutationsWithValue(operations, next.value?.id)
  }

  const moveSubtree: Commands['mindmap']['moveSubtree'] = (id, nodeId, newParentId, options) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const fromParentId = current.nodes[nodeId]?.parentId
    const fromIndex = fromParentId ? (current.children[fromParentId] ?? []).indexOf(nodeId) : -1
    const requestedIndex = options?.index
    const adjustedIndex =
      typeof requestedIndex === 'number' && fromParentId === newParentId && fromIndex >= 0 && requestedIndex > fromIndex
        ? Math.max(0, requestedIndex - 1)
        : requestedIndex

    const next = moveMindmapSubtree(current, nodeId, newParentId, {
      index: adjustedIndex,
      side: options?.side
    })
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    const operations = createReplaceOperations(id, current, next.tree, options?.layout)
    return instance.mutate(operations, 'ui')
  }

  const removeSubtree: Commands['mindmap']['removeSubtree'] = (id, nodeId) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = removeMindmapSubtree(current, nodeId)
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return instance.mutate(
      createReplaceOperations(id, current, next.tree),
      'ui'
    )
  }

  const cloneSubtree: Commands['mindmap']['cloneSubtree'] = (id, nodeId, options) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = cloneMindmapSubtree(current, nodeId, {
      parentId: options?.parentId,
      index: options?.index,
      side: options?.side,
      idGenerator: {
        nodeId: createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return runMutationsWithValue(
      createReplaceOperations(id, current, next.tree),
      next.value?.id
    )
  }

  const toggleCollapse: Commands['mindmap']['toggleCollapse'] = (id, nodeId, collapsed) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = toggleMindmapCollapse(current, nodeId, collapsed)
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return instance.mutate(
      createReplaceOperations(id, current, next.tree),
      'ui'
    )
  }

  const setNodeData: Commands['mindmap']['setNodeData'] = (id, nodeId, patch) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = setMindmapNodeData(current, nodeId, patch)
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return instance.mutate(
      createReplaceOperations(id, current, next.tree),
      'ui'
    )
  }

  const reorderChild: Commands['mindmap']['reorderChild'] = (id, parentId, fromIndex, toIndex) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = reorderMindmapChild(current, parentId, fromIndex, toIndex)
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return instance.mutate(
      createReplaceOperations(id, current, next.tree),
      'ui'
    )
  }

  const setSide: Commands['mindmap']['setSide'] = (id, nodeId, side) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = setMindmapSide(current, nodeId, side)
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return instance.mutate(
      createReplaceOperations(id, current, next.tree),
      'ui'
    )
  }

  const attachExternal: Commands['mindmap']['attachExternal'] = (id, targetId, payload, options) => {
    const current = readMindmap(id)
    if (!current) {
      return Promise.resolve(createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = attachMindmapExternal(current, targetId, payload, {
      index: options?.index,
      side: options?.side,
      idGenerator: {
        nodeId: createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(createInvalidResult(next.error))
    }

    return runMutationsWithValue(
      createReplaceOperations(id, current, next.tree),
      next.value?.id
    )
  }

  return {
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
    attachExternal
  }
}
