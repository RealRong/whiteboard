import type { Core, Document, Edge, Node, NodeId, Point } from '@whiteboard/core'
import { enlargeBox } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { getGroupDescendants, getNodesBoundingRect } from '../../node/utils/group'
import type { Shortcut, ShortcutContext } from './types'
import type { UseSelectionReturn } from '../../node/hooks'

const extractNodeId = (result: { ok: boolean; changes?: { operations: Array<any> } }) => {
  if (!result.ok || !result.changes) return undefined
  const op = result.changes.operations.find(
    (operation: any): operation is { type: 'node.create'; node: Node } =>
      operation.type === 'node.create' && operation.node
  )
  return op?.node?.id
}

type ShortcutDependencies = {
  core: Core
  getDocument: () => Document
  getSelectableNodeIds: () => NodeId[]
  nodeSize: Size
  defaultGroupPadding: number
  selection: UseSelectionReturn
  selectEdge?: (id?: string) => void
}

const createGroupFromSelection = async (
  deps: ShortcutDependencies,
  ctx: ShortcutContext
) => {
  const { core, getDocument, nodeSize, defaultGroupPadding, selection } = deps
  if (ctx.selection.count < 2) return
  const doc = getDocument()
  const nodes = doc.nodes.filter((node) => ctx.selection.selectedNodeIds.includes(node.id))
  if (nodes.length < 2) return
  const contentRect = getNodesBoundingRect(nodes, nodeSize)
  if (!contentRect) return
  const padding = defaultGroupPadding
  const groupRect = enlargeBox(contentRect, padding)
  const createResult = await core.dispatch({
    type: 'node.create',
    payload: {
      type: 'group',
      position: { x: groupRect.x, y: groupRect.y },
      size: { width: groupRect.width, height: groupRect.height },
      data: {
        padding,
        autoFit: 'expand-only'
      }
    }
  })
  const groupId = extractNodeId(createResult)
  if (!groupId) return
  for (const node of nodes) {
    await core.dispatch({ type: 'node.update', id: node.id, patch: { parentId: groupId } })
  }
  selection.select([groupId], 'replace')
}

const ungroupSelection = async (deps: ShortcutDependencies, ctx: ShortcutContext) => {
  const { core, getDocument, selection } = deps
  const doc = getDocument()
  const groups = doc.nodes.filter(
    (node) => node.type === 'group' && ctx.selection.selectedNodeIds.includes(node.id)
  )
  if (!groups.length) return
  for (const group of groups) {
    const children = doc.nodes.filter((node) => node.parentId === group.id)
    for (const child of children) {
      await core.dispatch({ type: 'node.update', id: child.id, patch: { parentId: undefined } })
    }
    await core.dispatch({ type: 'node.delete', ids: [group.id] })
  }
  selection.clear()
}

const runRegisteredCommand = (core: Core, names: string[]) => {
  for (const name of names) {
    const command = core.registries.commands.get(name)
    if (command) {
      command()
      return true
    }
  }
  return false
}

const clonePoint = (point: Point) => ({ x: point.x, y: point.y })

const buildNodeCopy = (node: Node, parentId: NodeId | undefined, delta: Point) => {
  return {
    type: node.type,
    position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
    size: node.size ? { width: node.size.width, height: node.size.height } : undefined,
    rotation: typeof node.rotation === 'number' ? node.rotation : undefined,
    layer: node.layer,
    zIndex: typeof node.zIndex === 'number' ? node.zIndex : undefined,
    locked: typeof node.locked === 'boolean' ? node.locked : undefined,
    data: node.data ? { ...node.data } : undefined,
    style: node.style ? { ...node.style } : undefined,
    parentId
  }
}

const buildEdgeCopy = (edge: Edge, sourceNodeId: NodeId, targetNodeId: NodeId) => {
  return {
    type: edge.type,
    source: { ...edge.source, nodeId: sourceNodeId },
    target: { ...edge.target, nodeId: targetNodeId },
    routing: edge.routing
      ? {
          ...edge.routing,
          points: edge.routing.points ? edge.routing.points.map(clonePoint) : undefined
        }
      : undefined,
    style: edge.style ? { ...edge.style } : undefined,
    label: edge.label
      ? {
          ...edge.label,
          offset: edge.label.offset ? clonePoint(edge.label.offset) : undefined
        }
      : undefined,
    data: edge.data ? { ...edge.data } : undefined
  }
}

const expandSelection = (nodes: Node[], selectedIds: string[]) => {
  const nodeMap = new Map<NodeId, Node>(nodes.map((node) => [node.id, node]))
  const expanded = new Set<NodeId>(selectedIds)
  selectedIds.forEach((id) => {
    const node = nodeMap.get(id)
    if (node?.type === 'group') {
      getGroupDescendants(nodes, id).forEach((child) => expanded.add(child.id))
    }
  })
  return { expanded, nodeMap }
}

const duplicateSelection = async (deps: ShortcutDependencies, ctx: ShortcutContext) => {
  const { core, getDocument, selection } = deps
  const selectedIds = ctx.selection.selectedNodeIds
  if (!selectedIds.length) return
  const doc = getDocument()
  const { expanded, nodeMap } = expandSelection(doc.nodes, selectedIds)
  const nodes = Array.from(expanded)
    .map((id) => nodeMap.get(id))
    .filter((node): node is Node => Boolean(node))

  const depthCache = new Map<NodeId, number>()
  const getDepth = (node: Node): number => {
    if (!node.parentId || !expanded.has(node.parentId)) return 0
    const cached = depthCache.get(node.id)
    if (cached !== undefined) return cached
    const parent = nodeMap.get(node.parentId)
    const depth = parent ? getDepth(parent) + 1 : 0
    depthCache.set(node.id, depth)
    return depth
  }

  nodes.sort((a, b) => getDepth(a) - getDepth(b))

  const idMap = new Map<NodeId, NodeId>()
  const createdIds: NodeId[] = []
  const offset = { x: 24, y: 24 }

  await core.commands.transaction(async () => {
    for (const node of nodes) {
      const parentId = node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : node.parentId
      const payload = buildNodeCopy(node, parentId, offset)
      const result = await core.dispatch({ type: 'node.create', payload })
      const createdId = extractNodeId(result)
      if (createdId) {
        idMap.set(node.id, createdId)
        createdIds.push(createdId)
      }
    }
    const edges = doc.edges.filter(
      (edge) => expanded.has(edge.source.nodeId) && expanded.has(edge.target.nodeId)
    )
    for (const edge of edges) {
      const sourceId = idMap.get(edge.source.nodeId)
      const targetId = idMap.get(edge.target.nodeId)
      if (!sourceId || !targetId) continue
      const payload = buildEdgeCopy(edge, sourceId, targetId)
      await core.dispatch({ type: 'edge.create', payload })
    }
  })

  if (createdIds.length) {
    selection.select(createdIds, 'replace')
  }
}

export const createDefaultShortcuts = (deps: ShortcutDependencies): Shortcut[] => [
  {
    id: 'group.create',
    title: 'Group',
    category: 'group',
    keys: ['Mod+G'],
    when: (ctx) => ctx.selection.count >= 2 && !ctx.focus.isEditingText,
    handler: (ctx) => {
      void createGroupFromSelection(deps, ctx)
    }
  },
  {
    id: 'group.ungroup',
    title: 'Ungroup',
    category: 'group',
    keys: ['Shift+Mod+G'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: (ctx) => {
      void ungroupSelection(deps, ctx)
    }
  },
  {
    id: 'selection.selectAll',
    title: 'Select All',
    category: 'edit',
    keys: ['Mod+A'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      const ids = deps.getSelectableNodeIds()
      deps.selection.select(ids, 'replace')
    }
  },
  {
    id: 'selection.clear',
    title: 'Clear Selection',
    category: 'edit',
    keys: ['Escape'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.selection.clear()
    }
  },
  {
    id: 'edit.delete',
    title: 'Delete',
    category: 'edit',
    keys: ['Backspace', 'Delete'],
    when: (ctx) => (ctx.selection.hasSelection || Boolean(ctx.selection.selectedEdgeId)) && !ctx.focus.isEditingText,
    handler: (ctx) => {
      if (ctx.selection.selectedEdgeId) {
        void deps.core.dispatch({ type: 'edge.delete', ids: [ctx.selection.selectedEdgeId] })
        deps.selectEdge?.(undefined)
        return
      }
      if (!ctx.selection.selectedNodeIds.length) return
      const doc = deps.getDocument()
      const { expanded } = expandSelection(doc.nodes, ctx.selection.selectedNodeIds)
      const ids = Array.from(expanded)
      const edgeIds = doc.edges
        .filter((edge) => expanded.has(edge.source.nodeId) || expanded.has(edge.target.nodeId))
        .map((edge) => edge.id)
      if (edgeIds.length) {
        void deps.core.dispatch({ type: 'edge.delete', ids: edgeIds })
      }
      void deps.core.dispatch({ type: 'node.delete', ids })
      deps.selection.clear()
    }
  },
  {
    id: 'edit.duplicate',
    title: 'Duplicate',
    category: 'edit',
    keys: ['Mod+D'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: (ctx) => {
      void duplicateSelection(deps, ctx)
    }
  },
  {
    id: 'history.undo',
    title: 'Undo',
    category: 'edit',
    keys: ['Mod+Z'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      runRegisteredCommand(deps.core, ['history.undo', 'undo'])
    }
  },
  {
    id: 'history.redo',
    title: 'Redo',
    category: 'edit',
    keys: ['Shift+Mod+Z', 'Mod+Y'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      runRegisteredCommand(deps.core, ['history.redo', 'redo'])
    }
  }
]
