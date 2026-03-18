import { err, ok } from '../types/result'
import type {
  MindmapAttachPayload,
  MindmapCommandResult,
  MindmapIdGenerator,
  MindmapNode,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree
} from './types'
import { createId } from '../utils/id'

type TreeDraft = MindmapTree

const createFailure = (message: string) => err('invalid', message)

const getDefaultNodeId = () => createId('mnode')
const getDefaultTreeId = () => createId('mindmap')

const cloneTree = (tree: MindmapTree): TreeDraft => ({
  ...tree,
  nodes: { ...tree.nodes },
  children: Object.fromEntries(Object.entries(tree.children).map(([id, list]) => [id, [...list]])),
  meta: tree.meta ? { ...tree.meta } : undefined
})

const ensureChildren = (tree: TreeDraft, id: MindmapNodeId) => {
  if (!tree.children[id]) {
    tree.children[id] = []
  }
  return tree.children[id]
}

const ensureNode = (tree: MindmapTree, id: MindmapNodeId) => tree.nodes[id]

const updateMeta = (tree: TreeDraft, timestamp = new Date().toISOString()) => {
  if (!tree.meta) {
    tree.meta = { createdAt: timestamp, updatedAt: timestamp }
  } else {
    if (!tree.meta.createdAt) tree.meta.createdAt = timestamp
    tree.meta.updatedAt = timestamp
  }
}

const collectSubtreeIds = (tree: MindmapTree, rootId: MindmapNodeId) => {
  const result: MindmapNodeId[] = []
  const stack: MindmapNodeId[] = [rootId]
  const visited = new Set<MindmapNodeId>()
  while (stack.length) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    result.push(current)
    const children = tree.children[current] ?? []
    children.forEach((childId) => stack.push(childId))
  }
  return result
}

const isAncestorOf = (tree: MindmapTree, ancestorId: MindmapNodeId, nodeId: MindmapNodeId) => {
  let current = tree.nodes[nodeId]?.parentId
  while (current) {
    if (current === ancestorId) return true
    current = tree.nodes[current]?.parentId
  }
  return false
}

const normalizeMoveIndex = ({
  prevParentId,
  nextParentId,
  prevIndex,
  requestedIndex
}: {
  prevParentId: MindmapNodeId
  nextParentId: MindmapNodeId
  prevIndex: number
  requestedIndex: number | undefined
}) => {
  if (typeof requestedIndex !== 'number') return requestedIndex
  if (prevParentId !== nextParentId) return requestedIndex
  if (prevIndex < 0) return requestedIndex
  if (requestedIndex <= prevIndex) return requestedIndex
  return Math.max(0, requestedIndex - 1)
}

export const createMindmap = (
  options: {
    id?: MindmapTree['id']
    rootId?: MindmapNodeId
    rootData?: MindmapNodeData
    idGenerator?: MindmapIdGenerator
  } = {}
): MindmapTree => {
  const createTreeId = options.idGenerator?.treeId ?? getDefaultTreeId
  const createNodeId = options.idGenerator?.nodeId ?? getDefaultNodeId
  const id = options.id ?? createTreeId()
  const rootId = options.rootId ?? createNodeId()
  const rootNode: MindmapNode = {
    id: rootId,
    data: options.rootData ?? { kind: 'text', text: '' }
  }
  const now = new Date().toISOString()
  return {
    id,
    rootId,
    nodes: { [rootId]: rootNode },
    children: { [rootId]: [] },
    meta: { createdAt: now, updatedAt: now }
  }
}

export const addChild = (
  tree: MindmapTree,
  parentId: MindmapNodeId,
  payload?: MindmapNodeData | MindmapAttachPayload,
  options?: { index?: number; side?: 'left' | 'right'; idGenerator?: MindmapIdGenerator }
): MindmapCommandResult<{ nodeId: MindmapNodeId }> => {
  if (!ensureNode(tree, parentId)) {
    return createFailure(`Parent node ${parentId} not found.`)
  }
  const createNodeId = options?.idGenerator?.nodeId ?? getDefaultNodeId
  const nodeId = createNodeId()
  if (tree.nodes[nodeId]) {
    return createFailure(`Node ${nodeId} already exists.`)
  }
  const draft = cloneTree(tree)
  const parent = draft.nodes[parentId]
  const node: MindmapNode = {
    id: nodeId,
    parentId: parentId,
    data: payload
  }
  if (parentId === draft.rootId) {
    node.side = options?.side ?? 'right'
  }
  draft.nodes[nodeId] = node
  ensureChildren(draft, nodeId)
  const children = ensureChildren(draft, parentId)
  const index = options?.index
  if (index === undefined || index < 0 || index > children.length) {
    children.push(nodeId)
  } else {
    children.splice(index, 0, nodeId)
  }
  updateMeta(draft)
  return ok({ tree: draft, nodeId })
}

export const addSibling = (
  tree: MindmapTree,
  nodeId: MindmapNodeId,
  position: 'before' | 'after',
  payload?: MindmapNodeData | MindmapAttachPayload,
  options?: { idGenerator?: MindmapIdGenerator }
): MindmapCommandResult<{ nodeId: MindmapNodeId }> => {
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  if (!node.parentId) return createFailure('Root node has no siblings.')
  const parentId = node.parentId
  const children = tree.children[parentId] ?? []
  const index = children.indexOf(nodeId)
  if (index < 0) return createFailure(`Node ${nodeId} not found in parent children.`)
  const insertIndex = position === 'before' ? index : index + 1
  const side = parentId === tree.rootId ? node.side : undefined
  return addChild(tree, parentId, payload, { index: insertIndex, side, idGenerator: options?.idGenerator })
}

export const moveSubtree = (
  tree: MindmapTree,
  nodeId: MindmapNodeId,
  newParentId: MindmapNodeId,
  options?: { index?: number; side?: 'left' | 'right' }
): MindmapCommandResult => {
  if (nodeId === tree.rootId) return createFailure('Root node cannot be moved.')
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  if (!ensureNode(tree, newParentId)) return createFailure(`Parent node ${newParentId} not found.`)
  if (isAncestorOf(tree, nodeId, newParentId)) return createFailure('Cannot move node into its own subtree.')

  const draft = cloneTree(tree)
  const prevParentId = node.parentId
  if (!prevParentId) return createFailure('Node parent missing.')
  const prevChildren = draft.children[prevParentId] ?? []
  const prevIndex = prevChildren.indexOf(nodeId)
  if (prevIndex >= 0) {
    prevChildren.splice(prevIndex, 1)
  }

  const nextChildren = ensureChildren(draft, newParentId)
  const insertIndex = normalizeMoveIndex({
    prevParentId,
    nextParentId: newParentId,
    prevIndex,
    requestedIndex: options?.index
  })
  if (insertIndex === undefined || insertIndex < 0 || insertIndex > nextChildren.length) {
    nextChildren.push(nodeId)
  } else {
    nextChildren.splice(insertIndex, 0, nodeId)
  }

  const nextNode = { ...draft.nodes[nodeId], parentId: newParentId }
  if (newParentId === draft.rootId) {
    nextNode.side = options?.side ?? nextNode.side ?? 'right'
  } else if (nextNode.side) {
    delete nextNode.side
  }
  draft.nodes[nodeId] = nextNode
  updateMeta(draft)
  return ok({ tree: draft })
}

export const removeSubtree = (tree: MindmapTree, nodeId: MindmapNodeId): MindmapCommandResult => {
  if (nodeId === tree.rootId) return createFailure('Root node cannot be removed.')
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  const draft = cloneTree(tree)
  const parentId = node.parentId
  if (parentId) {
    const siblings = draft.children[parentId] ?? []
    const index = siblings.indexOf(nodeId)
    if (index >= 0) siblings.splice(index, 1)
  }
  const subtreeIds = collectSubtreeIds(tree, nodeId)
  subtreeIds.forEach((id) => {
    delete draft.nodes[id]
    delete draft.children[id]
  })
  updateMeta(draft)
  return ok({ tree: draft })
}

export const cloneSubtree = (
  tree: MindmapTree,
  nodeId: MindmapNodeId,
  options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right'; idGenerator?: MindmapIdGenerator }
): MindmapCommandResult<{ nodeId: MindmapNodeId; map: Record<MindmapNodeId, MindmapNodeId> }> => {
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  const parentId = options?.parentId ?? node.parentId
  if (!parentId) return createFailure('Root clone requires explicit parentId.')
  if (!ensureNode(tree, parentId)) return createFailure(`Parent node ${parentId} not found.`)
  if (isAncestorOf(tree, nodeId, parentId)) return createFailure('Cannot clone into its own subtree.')

  const createNodeId = options?.idGenerator?.nodeId ?? getDefaultNodeId
  const subtreeIds = collectSubtreeIds(tree, nodeId)
  const idMap: Record<MindmapNodeId, MindmapNodeId> = {}
  subtreeIds.forEach((id) => {
    idMap[id] = createNodeId()
  })

  const draft = cloneTree(tree)
  subtreeIds.forEach((id) => {
    const source = tree.nodes[id]
    const nextId = idMap[id]
    const nextParentId = source.parentId ? idMap[source.parentId] : undefined
    const nextNode: MindmapNode = {
      ...source,
      id: nextId,
      parentId: id === nodeId ? parentId : nextParentId
    }
    if (id === nodeId && parentId === draft.rootId) {
      nextNode.side = options?.side ?? source.side ?? 'right'
    } else if (nextNode.side && parentId !== draft.rootId) {
      delete nextNode.side
    }
    draft.nodes[nextId] = nextNode
  })

  subtreeIds.forEach((id) => {
    const sourceChildren = tree.children[id] ?? []
    const nextId = idMap[id]
    draft.children[nextId] = sourceChildren.map((childId) => idMap[childId])
  })

  const insertTarget = ensureChildren(draft, parentId)
  const rootCloneId = idMap[nodeId]
  const insertIndex = options?.index
  if (insertIndex === undefined || insertIndex < 0 || insertIndex > insertTarget.length) {
    insertTarget.push(rootCloneId)
  } else {
    insertTarget.splice(insertIndex, 0, rootCloneId)
  }

  updateMeta(draft)
  return ok({ tree: draft, nodeId: rootCloneId, map: idMap })
}

export const toggleCollapse = (
  tree: MindmapTree,
  nodeId: MindmapNodeId,
  collapsed?: boolean
): MindmapCommandResult => {
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  const draft = cloneTree(tree)
  draft.nodes[nodeId] = {
    ...draft.nodes[nodeId],
    collapsed: collapsed ?? !draft.nodes[nodeId].collapsed
  }
  updateMeta(draft)
  return ok({ tree: draft })
}

export const setNodeData = (
  tree: MindmapTree,
  nodeId: MindmapNodeId,
  patch: Partial<MindmapNodeData | Record<string, unknown>>
): MindmapCommandResult => {
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  const draft = cloneTree(tree)
  const existing = draft.nodes[nodeId].data ?? {}
  const nextData = typeof existing === 'object' && typeof patch === 'object' ? { ...existing, ...patch } : patch
  draft.nodes[nodeId] = {
    ...draft.nodes[nodeId],
    data: nextData
  }
  updateMeta(draft)
  return ok({ tree: draft })
}

export const reorderChild = (
  tree: MindmapTree,
  parentId: MindmapNodeId,
  fromIndex: number,
  toIndex: number
): MindmapCommandResult => {
  if (!ensureNode(tree, parentId)) return createFailure(`Node ${parentId} not found.`)
  const children = tree.children[parentId] ?? []
  if (fromIndex < 0 || fromIndex >= children.length) return createFailure('fromIndex out of bounds.')
  if (toIndex < 0 || toIndex >= children.length) return createFailure('toIndex out of bounds.')
  const draft = cloneTree(tree)
  const nextChildren = draft.children[parentId]
  const [moved] = nextChildren.splice(fromIndex, 1)
  nextChildren.splice(toIndex, 0, moved)
  updateMeta(draft)
  return ok({ tree: draft })
}

export const setSide = (
  tree: MindmapTree,
  nodeId: MindmapNodeId,
  side: 'left' | 'right'
): MindmapCommandResult => {
  const node = ensureNode(tree, nodeId)
  if (!node) return createFailure(`Node ${nodeId} not found.`)
  if (node.parentId !== tree.rootId) return createFailure('Only root-level children can have side.')
  const draft = cloneTree(tree)
  draft.nodes[nodeId] = {
    ...draft.nodes[nodeId],
    side
  }
  updateMeta(draft)
  return ok({ tree: draft })
}

export const attachExternal = (
  tree: MindmapTree,
  targetId: MindmapNodeId,
  payload: MindmapAttachPayload,
  options?: { index?: number; side?: 'left' | 'right'; idGenerator?: MindmapIdGenerator }
): MindmapCommandResult<{ nodeId: MindmapNodeId }> => {
  return addChild(tree, targetId, payload, options)
}
