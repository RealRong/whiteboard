import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  MindmapId,
  MindmapLayoutHint,
  MindmapNodeId,
  MindmapTree,
  Node,
  Operation
} from '@whiteboard/core/types'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  attachExternal as attachMindmapExternal,
  cloneSubtree as cloneMindmapSubtree,
  createMindmap,
  getSide as getMindmapSide,
  layoutMindmap,
  layoutMindmapTidy,
  moveSubtree as moveMindmapSubtree,
  removeSubtree as removeMindmapSubtree,
  reorderChild as reorderMindmapChild,
  setNodeData as setMindmapNodeData,
  setSide as setMindmapSide,
  toggleCollapse as toggleMindmapCollapse
} from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../config'
import { StateWatchEmitter } from '../../runtime/actors/shared/StateWatchEmitter'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'view' | 'document' | 'projection' | 'mutate' | 'emit' | 'config'>
}

export type MindmapController = Commands['mindmap'] & {
  readonly name: 'Mindmap'
  start: () => void
  stop: () => void
}

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (typeof clone === 'function') {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const isSameOptions = (
  left?: Record<string, unknown>,
  right?: Record<string, unknown>
) => {
  if (!left || !right) return !left && !right

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false
  }
  return true
}

const isSameLayout = (
  left: MindmapLayoutConfig,
  right: MindmapLayoutConfig
) =>
  left.mode === right.mode &&
  isSameOptions(
    left.options as Record<string, unknown> | undefined,
    right.options as Record<string, unknown> | undefined
  )

const cloneLayout = (
  layout: MindmapLayoutConfig
): MindmapLayoutConfig => ({
  mode: layout.mode,
  options: layout.options
    ? { ...layout.options }
    : undefined
})

export const createMindmapController = ({ instance }: ActorOptions): MindmapController => {
  const state = instance.state
  const layoutEmitter = new StateWatchEmitter({
    state,
    keys: ['mindmapLayout'],
    read: () => state.read('mindmapLayout'),
    equals: isSameLayout,
    clone: cloneLayout,
    emit: (layout) => {
      instance.emit('mindmap.layout.changed', { layout: cloneLayout(layout) })
    }
  })

  const createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })

  const readMindmap = (id: string): MindmapTree | undefined =>
    (instance.document.get().mindmaps ?? []).find((tree) => tree.id === id)

  const readMindmapNode = (id: string): Node | undefined =>
    instance.document.get().nodes.find((node) => node.id === id)

  const createMindmapId = () => {
    const exists = (id: string) => Boolean(readMindmap(id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `mindmap_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `mindmap_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  const createMindmapNodeId = () => {
    const exists = (id: string) =>
      (instance.document.get().mindmaps ?? []).some((tree) => Boolean(tree.nodes[id as MindmapNodeId]))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `mnode_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `mnode_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  const cloneTree = (tree: MindmapTree): MindmapTree => cloneValue(tree)

  const cloneNode = (node: Node): Node => cloneValue(node)

  const runMutationsWithValue = async (
    operations: Operation[],
    value?: unknown
  ): Promise<DispatchResult> => {
    const result = await instance.mutate(operations, 'ui')
    if (!result.ok || typeof value === 'undefined') {
      return result
    }
    return {
      ...result,
      value
    }
  }

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

  const getLayoutHint = (hint?: MindmapLayoutHint) => {
    if (!hint?.nodeSize) return undefined
    if (!hint.anchorId) return undefined
    return hint
  }

  const computeAnchorWorld = (
    tree: MindmapTree,
    hint: MindmapLayoutHint,
    nodePosition: { x: number; y: number }
  ) => {
    const layoutFn = hint.mode === 'tidy' ? layoutMindmapTidy : layoutMindmap
    const layout = layoutFn(tree, () => hint.nodeSize as { width: number; height: number }, hint.options)
    const anchorId = hint.anchorId ?? tree.rootId
    const rect = layout.node[anchorId]
    if (!rect) return undefined
    const shiftX = -layout.bbox.x
    const shiftY = -layout.bbox.y
    return {
      x: nodePosition.x + rect.x + shiftX + rect.width / 2,
      y: nodePosition.y + rect.y + shiftY + rect.height / 2
    }
  }

  const computeAnchorPatch = (
    beforeTree: MindmapTree,
    afterTree: MindmapTree,
    hint: MindmapLayoutHint,
    mindmapNode: Node
  ) => {
    const before = computeAnchorWorld(beforeTree, hint, mindmapNode.position)
    const after = computeAnchorWorld(afterTree, hint, mindmapNode.position)
    if (!before || !after) return undefined
    const dx = before.x - after.x
    const dy = before.y - after.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined
    return {
      position: {
        x: mindmapNode.position.x + dx,
        y: mindmapNode.position.y + dy
      }
    }
  }

  const appendAnchorPatch = (
    operations: Operation[],
    mindmapId: string,
    beforeTree: MindmapTree,
    afterTree: MindmapTree,
    layout?: MindmapLayoutHint
  ): Operation[] => {
    const layoutHint = getLayoutHint(layout)
    if (!layoutHint) return operations
    const mindmapNode = readMindmapNode(mindmapId)
    if (!mindmapNode) return operations
    const anchorPatch = computeAnchorPatch(beforeTree, afterTree, layoutHint, mindmapNode)
    if (!anchorPatch) return operations
    return [
      ...operations,
      {
        type: 'node.update',
        id: mindmapNode.id,
        patch: anchorPatch,
        before: cloneNode(mindmapNode)
      }
    ]
  }

  const createReplaceOperations = (
    id: string,
    before: MindmapTree,
    after: MindmapTree,
    layout?: MindmapLayoutHint
  ): Operation[] => {
    const operations: Operation[] = [
      {
        type: 'mindmap.replace',
        id,
        before: cloneTree(before),
        after: cloneTree(after)
      }
    ]
    return appendAnchorPatch(operations, id, before, after, layout)
  }

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

    const targetSide = getMindmapSide(tree, targetNodeId) ?? DEFAULT_TUNING.mindmap.defaultSide
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
    const node = instance.projection.getSnapshot().nodes.canvas.find((item) => item.id === nodeId)
    if (!node) return
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return
    }

    await instance.mutate(
      [{
        type: 'node.update',
        id: nodeId,
        patch: {
          position: { x: position.x, y: position.y }
        }
      }],
      'ui'
    )
  }

  const start = () => {
    layoutEmitter.start()
  }

  const stop = () => {
    layoutEmitter.stop()
  }

  return {
    name: 'Mindmap',
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
    moveRoot,
    start,
    stop
  }
}
