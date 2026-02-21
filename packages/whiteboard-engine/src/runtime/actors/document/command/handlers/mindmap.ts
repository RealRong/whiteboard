import type { Command } from '@engine-types/command'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  createMindmap,
  layoutMindmap,
  layoutMindmapTidy,
  moveSubtree as moveMindmapSubtree,
  type MindmapLayoutHint,
  type MindmapNode,
  type MindmapNodeId,
  type MindmapSubtree,
  type MindmapTree,
  type Node,
  type Operation
} from '@whiteboard/core'
import {
  createUniqueId,
  operationsPlan,
  invalidPlan,
  type ReduceContext
} from './helpers'

type MindmapCommand = Extract<
  Command,
  | { type: 'mindmap.create' }
  | { type: 'mindmap.replace' }
  | { type: 'mindmap.delete' }
  | { type: 'mindmap.addChild' }
  | { type: 'mindmap.addSibling' }
  | { type: 'mindmap.moveSubtree' }
  | { type: 'mindmap.removeSubtree' }
  | { type: 'mindmap.cloneSubtree' }
  | { type: 'mindmap.toggleCollapse' }
  | { type: 'mindmap.setNodeData' }
  | { type: 'mindmap.reorderChild' }
  | { type: 'mindmap.setSide' }
  | { type: 'mindmap.attachExternal' }
>

const collectSubtree = (
  tree: MindmapTree,
  rootId: MindmapNodeId
): MindmapSubtree => {
  const nodes: Record<MindmapNodeId, MindmapNode> = {}
  const children: Record<MindmapNodeId, MindmapNodeId[]> = {}
  const stack: MindmapNodeId[] = [rootId]
  const visited = new Set<MindmapNodeId>()
  while (stack.length) {
    const currentId = stack.pop()
    if (!currentId || visited.has(currentId)) {
      continue
    }
    visited.add(currentId)
    const node = tree.nodes[currentId]
    if (node) {
      nodes[currentId] = { ...node }
    }
    const childIds = tree.children[currentId] ?? []
    children[currentId] = [...childIds]
    childIds.forEach((childId) => stack.push(childId))
  }
  return { nodes, children }
}

const getChildren = (
  tree: MindmapTree,
  id: MindmapNodeId
) => tree.children[id] ?? []

const getLayoutHint = (
  hint?: MindmapLayoutHint
) => {
  if (!hint?.nodeSize) return
  if (!hint.anchorId) return
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
  if (!rect) return
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
  if (!before || !after) return
  const dx = before.x - after.x
  const dy = before.y - after.y
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
  return {
    position: {
      x: mindmapNode.position.x + dx,
      y: mindmapNode.position.y + dy
    }
  }
}

export const planMindmapCommand = (
  context: ReduceContext,
  command: MindmapCommand
) => {
  switch (command.type) {
    case 'mindmap.create': {
      const payload = command.payload
      if (payload?.id && context.core.query.mindmap.get(payload.id)) {
        return invalidPlan(`Mindmap ${payload.id} already exists.`)
      }
      const mindmap = createMindmap({
        id: payload?.id ?? createUniqueId('mindmap', (id) => Boolean(context.core.query.mindmap.get(id))),
        rootId: payload?.rootId,
        rootData: payload?.rootData,
        idGenerator: {
          treeId: () => createUniqueId('mindmap', (id) => Boolean(context.core.query.mindmap.get(id))),
          nodeId: () => createUniqueId('mnode', () => false)
        }
      })
      return operationsPlan([{ type: 'mindmap.create', mindmap }], mindmap.id, true)
    }
    case 'mindmap.replace': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      if (command.tree.id !== command.id) {
        return invalidPlan('Mindmap id mismatch.')
      }
      return operationsPlan(
        [
          {
            type: 'mindmap.replace',
            id: command.id,
            before: current,
            after: command.tree
          }
        ]
      )
    }
    case 'mindmap.delete': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No mindmap ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const tree = context.core.query.mindmap.get(id)
        if (!tree) {
          return invalidPlan(`Mindmap ${id} not found.`)
        }
        operations.push({
          type: 'mindmap.delete',
          id,
          before: tree
        })
      }
      return operationsPlan(operations)
    }
    case 'mindmap.addChild': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const layoutHint = getLayoutHint(command.options?.layout)
      const mindmapNode = layoutHint ? context.core.query.node.get(command.id) : undefined
      const nodeId = createUniqueId('mnode', (id) => Boolean(current.nodes[id])) as MindmapNodeId
      const node: MindmapNode = {
        id: nodeId,
        parentId: command.parentId,
        data: command.payload as MindmapNode['data']
      }
      if (command.parentId === current.rootId) {
        node.side = command.options?.side ?? 'right'
      }

      let anchorPatch: { position: { x: number; y: number } } | undefined
      if (layoutHint && mindmapNode) {
        const nextTree = addMindmapChild(current, command.parentId, command.payload, {
          index: command.options?.index,
          side: command.options?.side,
          idGenerator: {
            nodeId: () => nodeId
          }
        })
        if (nextTree.ok) {
          anchorPatch = computeAnchorPatch(current, nextTree.tree, layoutHint, mindmapNode)
        }
      }

      const operations: Operation[] = [
        {
          type: 'mindmap.node.create',
          id: command.id,
          node,
          parentId: command.parentId,
          index: command.options?.index
        }
      ]
      if (anchorPatch && mindmapNode) {
        operations.push({
          type: 'node.update',
          id: mindmapNode.id,
          patch: anchorPatch,
          before: mindmapNode
        })
      }

      return operationsPlan(operations, nodeId, true)
    }
    case 'mindmap.addSibling': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const layoutHint = getLayoutHint(command.options?.layout)
      const mindmapNode = layoutHint ? context.core.query.node.get(command.id) : undefined
      const target = current.nodes[command.nodeId]
      if (!target || !target.parentId) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      const siblings = getChildren(current, target.parentId)
      const index = siblings.indexOf(command.nodeId)
      if (index < 0) {
        return invalidPlan(`Node ${command.nodeId} not found in parent.`)
      }
      const insertIndex = command.position === 'before' ? index : index + 1
      const nodeId = createUniqueId('mnode', (id) => Boolean(current.nodes[id])) as MindmapNodeId
      const node: MindmapNode = {
        id: nodeId,
        parentId: target.parentId,
        data: command.payload as MindmapNode['data']
      }
      if (target.parentId === current.rootId) {
        node.side = target.side ?? 'right'
      }

      let anchorPatch: { position: { x: number; y: number } } | undefined
      if (layoutHint && mindmapNode) {
        const nextTree = addMindmapSibling(current, command.nodeId, command.position, command.payload, {
          idGenerator: {
            nodeId: () => nodeId
          }
        })
        if (nextTree.ok) {
          anchorPatch = computeAnchorPatch(current, nextTree.tree, layoutHint, mindmapNode)
        }
      }

      const operations: Operation[] = [
        {
          type: 'mindmap.node.create',
          id: command.id,
          node,
          parentId: target.parentId,
          index: insertIndex
        }
      ]
      if (anchorPatch && mindmapNode) {
        operations.push({
          type: 'node.update',
          id: mindmapNode.id,
          patch: anchorPatch,
          before: mindmapNode
        })
      }

      return operationsPlan(operations, nodeId, true)
    }
    case 'mindmap.moveSubtree': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const layoutHint = getLayoutHint(command.options?.layout)
      const mindmapNode = layoutHint ? context.core.query.node.get(command.id) : undefined
      const node = current.nodes[command.nodeId]
      if (!node || !node.parentId) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      const fromParentId = node.parentId
      const fromIndex = getChildren(current, fromParentId).indexOf(command.nodeId)
      if (fromIndex < 0) {
        return invalidPlan(`Node ${command.nodeId} not found in parent.`)
      }
      const targetList = getChildren(current, command.newParentId)
      const toIndex =
        command.options?.index === undefined ||
        command.options.index < 0 ||
        command.options.index > targetList.length
          ? targetList.length
          : command.options.index
      const adjustedToIndex =
        fromParentId === command.newParentId && toIndex > fromIndex ? Math.max(0, toIndex - 1) : toIndex

      let anchorPatch: { position: { x: number; y: number } } | undefined
      if (layoutHint && mindmapNode) {
        const nextTree = moveMindmapSubtree(current, command.nodeId, command.newParentId, {
          index: adjustedToIndex,
          side: command.options?.side
        })
        if (nextTree.ok) {
          anchorPatch = computeAnchorPatch(current, nextTree.tree, layoutHint, mindmapNode)
        }
      }

      const operations: Operation[] = [
        {
          type: 'mindmap.node.move',
          id: command.id,
          nodeId: command.nodeId,
          fromParentId,
          toParentId: command.newParentId,
          fromIndex,
          toIndex: adjustedToIndex,
          fromSide: node.side,
          side: command.options?.side
        }
      ]
      if (anchorPatch && mindmapNode) {
        operations.push({
          type: 'node.update',
          id: mindmapNode.id,
          patch: anchorPatch,
          before: mindmapNode
        })
      }

      return operationsPlan(operations)
    }
    case 'mindmap.removeSubtree': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const node = current.nodes[command.nodeId]
      if (!node) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      const parentId = node.parentId
      const index = parentId ? (current.children[parentId] ?? []).indexOf(command.nodeId) : undefined
      return operationsPlan(
        [
          {
            type: 'mindmap.node.delete',
            id: command.id,
            nodeId: command.nodeId,
            parentId,
            index,
            subtree: collectSubtree(current, command.nodeId)
          }
        ]
      )
    }
    case 'mindmap.cloneSubtree': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const source = current.nodes[command.nodeId]
      if (!source) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      const parentId = command.options?.parentId ?? source.parentId
      if (!parentId) {
        return invalidPlan('Root clone requires explicit parentId.')
      }
      const subtree = collectSubtree(current, command.nodeId)
      const allocatedIds = new Set<MindmapNodeId>()
      const idMap: Record<MindmapNodeId, MindmapNodeId> = {}
      Object.keys(subtree.nodes).forEach((id) => {
        const nextId = createUniqueId(
          'mnode',
          (candidate) => Boolean(current.nodes[candidate]) || allocatedIds.has(candidate as MindmapNodeId)
        ) as MindmapNodeId
        allocatedIds.add(nextId)
        idMap[id as MindmapNodeId] = nextId
      })

      const operations: Operation[] = []
      const queue: MindmapNodeId[] = [command.nodeId]
      const parentMap: Record<MindmapNodeId, MindmapNodeId | undefined> = {
        [command.nodeId]: parentId
      }
      while (queue.length) {
        const currentId = queue.shift()
        if (!currentId) continue
        const newId = idMap[currentId]
        const node = subtree.nodes[currentId]
        if (!node) continue
        const nextParent = parentMap[currentId]
        const children = subtree.children[currentId] ?? []
        const newNode: MindmapNode = {
          ...node,
          id: newId,
          parentId: nextParent
        }
        if (nextParent === current.rootId) {
          newNode.side = command.options?.side ?? node.side ?? 'right'
        } else if (newNode.side && nextParent !== current.rootId) {
          delete newNode.side
        }
        const index = nextParent ? (subtree.children[nextParent] ?? []).indexOf(currentId) : undefined
        operations.push({
          type: 'mindmap.node.create',
          id: command.id,
          node: newNode,
          parentId: nextParent ?? parentId,
          index: currentId === command.nodeId ? command.options?.index : index
        })
        children.forEach((childId) => {
          parentMap[childId] = newId
          queue.push(childId)
        })
      }

      return operationsPlan(operations, idMap[command.nodeId], true)
    }
    case 'mindmap.toggleCollapse': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const node = current.nodes[command.nodeId]
      if (!node) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'mindmap.node.update',
            id: command.id,
            nodeId: command.nodeId,
            patch: { collapsed: command.collapsed ?? !node.collapsed },
            before: { ...node }
          }
        ]
      )
    }
    case 'mindmap.setNodeData': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const node = current.nodes[command.nodeId]
      if (!node) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'mindmap.node.update',
            id: command.id,
            nodeId: command.nodeId,
            patch: {
              data: {
                ...((node.data as Record<string, unknown> | undefined) ?? {}),
                ...command.patch
              }
            },
            before: { ...node }
          }
        ]
      )
    }
    case 'mindmap.reorderChild': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'mindmap.node.reorder',
            id: command.id,
            parentId: command.parentId,
            fromIndex: command.fromIndex,
            toIndex: command.toIndex
          }
        ]
      )
    }
    case 'mindmap.setSide': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const node = current.nodes[command.nodeId]
      if (!node) {
        return invalidPlan(`Node ${command.nodeId} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'mindmap.node.update',
            id: command.id,
            nodeId: command.nodeId,
            patch: { side: command.side },
            before: { ...node }
          }
        ]
      )
    }
    case 'mindmap.attachExternal': {
      const current = context.core.query.mindmap.get(command.id)
      if (!current) {
        return invalidPlan(`Mindmap ${command.id} not found.`)
      }
      const nodeId = createUniqueId('mnode', (id) => Boolean(current.nodes[id]))
      const node: MindmapNode = {
        id: nodeId,
        parentId: command.targetId,
        data: command.payload
      }
      if (command.targetId === current.rootId) {
        node.side = command.options?.side ?? 'right'
      }
      return operationsPlan(
        [
          {
            type: 'mindmap.node.create',
            id: command.id,
            node,
            parentId: command.targetId,
            index: command.options?.index
          }
        ],
        nodeId,
        true
      )
    }
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown command type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}
