import type {
  ChangeSet,
  CoreRegistries,
  DispatchFailure,
  DispatchResult,
  Intent,
  Node,
  NodeId,
  Edge,
  EdgeId,
  MindmapId,
  MindmapLayoutHint,
  MindmapTree,
  MindmapNode,
  MindmapNodeId,
  MindmapSubtree,
  Viewport
} from '../types/core'
import type { CoreState } from './state'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  createMindmap,
  moveSubtree as moveMindmapSubtree
} from '../mindmap/commands'
import { layoutMindmap, layoutMindmapTidy } from '../mindmap/layout'
import { applyEdgeDefaults, applyNodeDefaults } from '../schema'

type CreateFailure = (reason: DispatchFailure['reason'], message?: string) => DispatchResult

type BuildDependencies = {
  state: CoreState
  registries: CoreRegistries
  validateIntent: (intent: Intent) => string | undefined
  createFailure: CreateFailure
}

type BuildSuccess = { operations: ChangeSet['operations']; value?: unknown }
type BuildResult = BuildSuccess | DispatchResult

export const createBuildOperations = ({ state, registries, validateIntent, createFailure }: BuildDependencies) => {
  const {
    maps,
    createNodeId,
    createEdgeId,
    createMindmapId,
    createMindmapNodeId,
    cloneNode,
    cloneEdge,
    cloneMindmapTree,
    clonePoint
  } = state

  const getTree = (id: MindmapId) => maps.mindmaps.get(id)
  const getChildren = (tree: MindmapTree, id: MindmapNodeId) => tree.children[id] ?? []
  const ensureChildren = (tree: MindmapTree, id: MindmapNodeId) => {
    if (!tree.children[id]) tree.children[id] = []
    return tree.children[id]
  }

  const collectSubtree = (tree: MindmapTree, rootId: MindmapNodeId): MindmapSubtree => {
    const nodes: Record<MindmapNodeId, MindmapNode> = {}
    const children: Record<MindmapNodeId, MindmapNodeId[]> = {}
    const stack: MindmapNodeId[] = [rootId]
    const visited = new Set<MindmapNodeId>()
    while (stack.length) {
      const current = stack.pop()!
      if (visited.has(current)) continue
      visited.add(current)
      const node = tree.nodes[current]
      if (node) {
        nodes[current] = { ...node }
      }
      const childList = tree.children[current] ?? []
      children[current] = [...childList]
      childList.forEach((childId) => stack.push(childId))
    }
    return { nodes, children }
  }

  const getViewport = (): Viewport => {
    const viewport = state.getDocument().viewport
    if (!viewport) {
      return { center: { x: 0, y: 0 }, zoom: 1 }
    }
    return {
      center: clonePoint(viewport.center),
      zoom: viewport.zoom
    }
  }

  const getLayoutHint = (hint?: MindmapLayoutHint) => {
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

  const buildOperations = (intent: Intent): BuildResult => {
    const error = validateIntent(intent)
    if (error) {
      return createFailure('invalid', error)
    }
    switch (intent.type) {
      case 'node.create': {
        const input = applyNodeDefaults(intent.payload, registries)
        const id = input.id ?? createNodeId()
        const node: Node = {
          ...input,
          id
        }
        return { operations: [{ type: 'node.create', node }] }
      }
      case 'node.update': {
        const current = maps.nodes.get(intent.id)
        if (!current) return createFailure('invalid', `Node ${intent.id} not found.`)
        return {
          operations: [
            {
              type: 'node.update',
              id: intent.id,
              patch: intent.patch,
              before: cloneNode(current)
            }
          ]
        }
      }
      case 'node.delete': {
        const operations = intent.ids
          .map((id) => {
            const current = maps.nodes.get(id)
            if (!current) return null
            return { type: 'node.delete', id, before: cloneNode(current) } as const
          })
          .filter((item): item is { type: 'node.delete'; id: NodeId; before: Node } => Boolean(item))
        return { operations }
      }
      case 'edge.create': {
        const input = applyEdgeDefaults(intent.payload, registries)
        const id = input.id ?? createEdgeId()
        const edge: Edge = {
          ...input,
          type: input.type ?? 'linear',
          id
        }
        return { operations: [{ type: 'edge.create', edge }] }
      }
      case 'edge.update': {
        const current = maps.edges.get(intent.id)
        if (!current) return createFailure('invalid', `Edge ${intent.id} not found.`)
        return {
          operations: [
            {
              type: 'edge.update',
              id: intent.id,
              patch: intent.patch,
              before: cloneEdge(current)
            }
          ]
        }
      }
      case 'edge.delete': {
        const operations = intent.ids
          .map((id) => {
            const current = maps.edges.get(id)
            if (!current) return null
            return { type: 'edge.delete', id, before: cloneEdge(current) } as const
          })
          .filter((item): item is { type: 'edge.delete'; id: EdgeId; before: Edge } => Boolean(item))
        return { operations }
      }
      case 'mindmap.create': {
        const payload = intent.payload
        if (payload?.id && maps.mindmaps.has(payload.id)) {
          return createFailure('invalid', `Mindmap ${payload.id} already exists.`)
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
        return { operations: [{ type: 'mindmap.create', mindmap }], value: mindmap.id }
      }
      case 'mindmap.delete': {
        const operations = intent.ids
          .map((id) => {
            const current = maps.mindmaps.get(id)
            if (!current) return null
            return { type: 'mindmap.delete', id, before: cloneMindmapTree(current) } as const
          })
          .filter((item): item is { type: 'mindmap.delete'; id: MindmapId; before: MindmapTree } => Boolean(item))
        return { operations }
      }
      case 'mindmap.replace': {
        const current = maps.mindmaps.get(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        return {
          operations: [
            {
              type: 'mindmap.replace',
              id: intent.id,
              before: cloneMindmapTree(current),
              after: cloneMindmapTree(intent.tree)
            }
          ]
        }
      }
      case 'mindmap.addChild': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const layoutHint = getLayoutHint(intent.options?.layout)
        const mindmapNode = layoutHint ? maps.nodes.get(intent.id) : undefined
        const nodeId = createMindmapNodeId()
        const node: MindmapNode = {
          id: nodeId,
          parentId: intent.parentId,
          data: intent.payload as MindmapNode['data']
        }
        if (intent.parentId === current.rootId) {
          node.side = intent.options?.side ?? 'right'
        }
        let anchorPatch: { position: { x: number; y: number } } | undefined
        if (layoutHint && mindmapNode) {
          const nextTree = addMindmapChild(current, intent.parentId, intent.payload, {
            index: intent.options?.index,
            side: intent.options?.side,
            idGenerator: {
              nodeId: () => nodeId
            }
          })
          if (nextTree.ok) {
            anchorPatch = computeAnchorPatch(current, nextTree.tree, layoutHint, mindmapNode)
          }
        }
        return {
          operations: [
            {
              type: 'mindmap.node.create',
              id: intent.id,
              node,
              parentId: intent.parentId,
              index: intent.options?.index
            },
            ...(anchorPatch && mindmapNode
              ? [
                  {
                    type: 'node.update',
                    id: mindmapNode.id,
                    patch: anchorPatch,
                    before: cloneNode(mindmapNode)
                  } as const
                ]
              : [])
          ],
          value: nodeId
        }
      }
      case 'mindmap.addSibling': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const layoutHint = getLayoutHint(intent.options?.layout)
        const mindmapNode = layoutHint ? maps.nodes.get(intent.id) : undefined
        const target = current.nodes[intent.nodeId]
        if (!target || !target.parentId) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        const siblings = getChildren(current, target.parentId)
        const index = siblings.indexOf(intent.nodeId)
        if (index < 0) return createFailure('invalid', `Node ${intent.nodeId} not found in parent.`)
        const insertIndex = intent.position === 'before' ? index : index + 1
        const nodeId = createMindmapNodeId()
        const node: MindmapNode = {
          id: nodeId,
          parentId: target.parentId,
          data: intent.payload as MindmapNode['data']
        }
        if (target.parentId === current.rootId) {
          node.side = target.side ?? 'right'
        }
        let anchorPatch: { position: { x: number; y: number } } | undefined
        if (layoutHint && mindmapNode) {
          const nextTree = addMindmapSibling(current, intent.nodeId, intent.position, intent.payload, {
            idGenerator: {
              nodeId: () => nodeId
            }
          })
          if (nextTree.ok) {
            anchorPatch = computeAnchorPatch(current, nextTree.tree, layoutHint, mindmapNode)
          }
        }
        return {
          operations: [
            {
              type: 'mindmap.node.create',
              id: intent.id,
              node,
              parentId: target.parentId,
              index: insertIndex
            },
            ...(anchorPatch && mindmapNode
              ? [
                  {
                    type: 'node.update',
                    id: mindmapNode.id,
                    patch: anchorPatch,
                    before: cloneNode(mindmapNode)
                  } as const
                ]
              : [])
          ],
          value: nodeId
        }
      }
      case 'mindmap.moveSubtree': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const layoutHint = getLayoutHint(intent.options?.layout)
        const mindmapNode = layoutHint ? maps.nodes.get(intent.id) : undefined
        const node = current.nodes[intent.nodeId]
        if (!node || !node.parentId) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        const fromParentId = node.parentId
        const fromIndex = getChildren(current, fromParentId).indexOf(intent.nodeId)
        if (fromIndex < 0) return createFailure('invalid', `Node ${intent.nodeId} not found in parent.`)
        const targetList = getChildren(current, intent.newParentId)
        const toIndex =
          intent.options?.index === undefined || intent.options.index < 0 || intent.options.index > targetList.length
            ? targetList.length
            : intent.options.index
        const adjustedToIndex =
          fromParentId === intent.newParentId && toIndex > fromIndex ? Math.max(0, toIndex - 1) : toIndex
        let anchorPatch: { position: { x: number; y: number } } | undefined
        if (layoutHint && mindmapNode) {
          const nextTree = moveMindmapSubtree(current, intent.nodeId, intent.newParentId, {
            index: adjustedToIndex,
            side: intent.options?.side
          })
          if (nextTree.ok) {
            anchorPatch = computeAnchorPatch(current, nextTree.tree, layoutHint, mindmapNode)
          }
        }
        return {
          operations: [
            {
              type: 'mindmap.node.move',
              id: intent.id,
              nodeId: intent.nodeId,
              fromParentId,
              toParentId: intent.newParentId,
              fromIndex,
              toIndex: adjustedToIndex,
              side: intent.options?.side
            },
            ...(anchorPatch && mindmapNode
              ? [
                  {
                    type: 'node.update',
                    id: mindmapNode.id,
                    patch: anchorPatch,
                    before: cloneNode(mindmapNode)
                  } as const
                ]
              : [])
          ]
        }
      }
      case 'mindmap.removeSubtree': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const node = current.nodes[intent.nodeId]
        if (!node) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        const parentId = node.parentId
        const index = parentId ? getChildren(current, parentId).indexOf(intent.nodeId) : undefined
        const subtree = collectSubtree(current, intent.nodeId)
        return {
          operations: [
            {
              type: 'mindmap.node.delete',
              id: intent.id,
              nodeId: intent.nodeId,
              parentId,
              index,
              subtree
            }
          ]
        }
      }
      case 'mindmap.cloneSubtree': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const source = current.nodes[intent.nodeId]
        if (!source) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        const parentId = intent.options?.parentId ?? source.parentId
        if (!parentId) return createFailure('invalid', 'Root clone requires explicit parentId.')
        const subtree = collectSubtree(current, intent.nodeId)
        const idMap: Record<MindmapNodeId, MindmapNodeId> = {}
        Object.keys(subtree.nodes).forEach((id) => {
          idMap[id as MindmapNodeId] = createMindmapNodeId()
        })

        const operations: ChangeSet['operations'] = []
        const queue: MindmapNodeId[] = [intent.nodeId]
        const parentMap: Record<MindmapNodeId, MindmapNodeId | undefined> = {
          [intent.nodeId]: parentId
        }
        while (queue.length) {
          const currentId = queue.shift()!
          const newId = idMap[currentId]
          const node = subtree.nodes[currentId]
          const nextParent = parentMap[currentId]
          const children = subtree.children[currentId] ?? []
          const newNode: MindmapNode = {
            ...node,
            id: newId,
            parentId: nextParent
          }
          if (nextParent === current.rootId) {
            newNode.side = intent.options?.side ?? node.side ?? 'right'
          } else if (newNode.side && nextParent !== current.rootId) {
            delete newNode.side
          }
          const index = nextParent
            ? (subtree.children[nextParent] ?? []).indexOf(currentId)
            : undefined
          operations.push({
            type: 'mindmap.node.create',
            id: intent.id,
            node: newNode,
            parentId: nextParent ?? parentId,
            index: currentId === intent.nodeId ? intent.options?.index : index
          })
          children.forEach((childId) => {
            parentMap[childId] = newId
            queue.push(childId)
          })
        }

        return {
          operations,
          value: idMap[intent.nodeId]
        }
      }
      case 'mindmap.toggleCollapse': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const node = current.nodes[intent.nodeId]
        if (!node) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        const patch: Partial<MindmapNode> = { collapsed: intent.collapsed ?? !node.collapsed }
        return {
          operations: [
            {
              type: 'mindmap.node.update',
              id: intent.id,
              nodeId: intent.nodeId,
              patch,
              before: { ...node }
            }
          ]
        }
      }
      case 'mindmap.setNodeData': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const node = current.nodes[intent.nodeId]
        if (!node) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        const patch: Partial<MindmapNode> = { data: { ...(node.data as Record<string, unknown>), ...intent.patch } }
        return {
          operations: [
            {
              type: 'mindmap.node.update',
              id: intent.id,
              nodeId: intent.nodeId,
              patch,
              before: { ...node }
            }
          ]
        }
      }
      case 'mindmap.reorderChild': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        return {
          operations: [
            {
              type: 'mindmap.node.reorder',
              id: intent.id,
              parentId: intent.parentId,
              fromIndex: intent.fromIndex,
              toIndex: intent.toIndex
            }
          ]
        }
      }
      case 'mindmap.setSide': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const node = current.nodes[intent.nodeId]
        if (!node) return createFailure('invalid', `Node ${intent.nodeId} not found.`)
        return {
          operations: [
            {
              type: 'mindmap.node.update',
              id: intent.id,
              nodeId: intent.nodeId,
              patch: { side: intent.side },
              before: { ...node }
            }
          ]
        }
      }
      case 'mindmap.attachExternal': {
        const current = getTree(intent.id)
        if (!current) return createFailure('invalid', `Mindmap ${intent.id} not found.`)
        const nodeId = createMindmapNodeId()
        const node: MindmapNode = {
          id: nodeId,
          parentId: intent.targetId,
          data: intent.payload
        }
        if (intent.targetId === current.rootId) {
          node.side = intent.options?.side ?? 'right'
        }
        return {
          operations: [
            {
              type: 'mindmap.node.create',
              id: intent.id,
              node,
              parentId: intent.targetId,
              index: intent.options?.index
            }
          ],
          value: nodeId
        }
      }
      case 'viewport.set': {
        const before = getViewport()
        const after = {
          center: clonePoint(intent.viewport.center),
          zoom: intent.viewport.zoom
        }
        return {
          operations: [
            {
              type: 'viewport.update',
              before,
              after
            }
          ]
        }
      }
      case 'viewport.pan': {
        const before = getViewport()
        const after = {
          center: {
            x: before.center.x + intent.delta.x,
            y: before.center.y + intent.delta.y
          },
          zoom: before.zoom
        }
        return {
          operations: [
            {
              type: 'viewport.update',
              before,
              after
            }
          ]
        }
      }
      case 'viewport.zoom': {
        const before = getViewport()
        const nextZoom = before.zoom * intent.factor
        const anchor = intent.anchor
        const center = anchor
          ? {
              x: anchor.x - (anchor.x - before.center.x) / intent.factor,
              y: anchor.y - (anchor.y - before.center.y) / intent.factor
            }
          : before.center
        const after = {
          center,
          zoom: nextZoom
        }
        return {
          operations: [
            {
              type: 'viewport.update',
              before,
              after
            }
          ]
        }
      }
      default:
        return createFailure('unknown', 'Unsupported intent.')
    }
  }

  return {
    buildOperations
  }
}
