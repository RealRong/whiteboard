import type {
  Core,
  DispatchResult,
  Document,
  Edge,
  EdgeId,
  EdgeInput,
  Node,
  NodeId,
  NodeInput,
  Point
} from '@whiteboard/core'
import type { SelectionMode } from '@engine-types/state'
import { getGroupDescendants } from '../../node/utils/group'

type ShortcutSelectionApi = {
  select: (ids: NodeId[], mode?: SelectionMode) => void
  clear: () => void
}

type ShortcutCommandDeps = {
  runTransaction: (recipe: () => Promise<void>) => Promise<unknown>
  node: {
    create: (payload: NodeInput) => Promise<DispatchResult>
    delete: (ids: NodeId[]) => Promise<DispatchResult>
  }
  edge: {
    create: (payload: EdgeInput) => Promise<DispatchResult>
    delete: (ids: EdgeId[]) => Promise<DispatchResult>
  }
  group: {
    create: (ids: NodeId[]) => Promise<DispatchResult>
    ungroup: (id: NodeId) => Promise<DispatchResult>
  }
  history: {
    undo: () => boolean
    redo: () => boolean
  }
  getDocument: () => Document
  getSelectableNodeIds: () => NodeId[]
  getSelectedNodeIds: () => NodeId[]
  getSelectedEdgeId: () => EdgeId | undefined
  selection: ShortcutSelectionApi
  selectEdge?: (id?: EdgeId) => void
}

const extractCreatedNodeId = (result: DispatchResult, type?: string) => {
  if (!result.ok) return undefined
  const op = result.changes.operations.find(
    (operation): operation is { type: 'node.create'; node: Node } =>
      operation.type === 'node.create' && operation.node && (!type || operation.node.type === type)
  )
  return op?.node?.id
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

const createGroupFromSelection = async (deps: ShortcutCommandDeps) => {
  const selectedNodeIds = deps.getSelectedNodeIds()
  if (selectedNodeIds.length < 2) return

  const result = await deps.group.create(selectedNodeIds)
  const groupId = extractCreatedNodeId(result, 'group')
  if (!groupId) return
  deps.selection.select([groupId], 'replace')
}

const ungroupSelection = async (deps: ShortcutCommandDeps) => {
  const selectedNodeIds = deps.getSelectedNodeIds()
  if (!selectedNodeIds.length) return

  const doc = deps.getDocument()
  const groups = doc.nodes.filter((node) => node.type === 'group' && selectedNodeIds.includes(node.id))
  if (!groups.length) return

  for (const group of groups) {
    await deps.group.ungroup(group.id)
  }
  deps.selection.clear()
}

const deleteSelection = async (deps: ShortcutCommandDeps) => {
  const selectedEdgeId = deps.getSelectedEdgeId()
  if (selectedEdgeId) {
    await deps.edge.delete([selectedEdgeId])
    deps.selectEdge?.(undefined)
    return
  }

  const selectedNodeIds = deps.getSelectedNodeIds()
  if (!selectedNodeIds.length) return

  const doc = deps.getDocument()
  const { expanded } = expandSelection(doc.nodes, selectedNodeIds)
  const ids = Array.from(expanded)
  const edgeIds = doc.edges
    .filter((edge) => expanded.has(edge.source.nodeId) || expanded.has(edge.target.nodeId))
    .map((edge) => edge.id)

  await deps.runTransaction(async () => {
    if (edgeIds.length) {
      await deps.edge.delete(edgeIds)
    }
    await deps.node.delete(ids)
  })

  deps.selection.clear()
}

const duplicateSelection = async (deps: ShortcutCommandDeps) => {
  const selectedIds = deps.getSelectedNodeIds()
  if (!selectedIds.length) return

  const doc = deps.getDocument()
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

  await deps.runTransaction(async () => {
    for (const node of nodes) {
      const parentId = node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : node.parentId
      const payload = buildNodeCopy(node, parentId, offset)
      const result = await deps.node.create(payload)
      const createdId = extractCreatedNodeId(result)
      if (createdId) {
        idMap.set(node.id, createdId)
        createdIds.push(createdId)
      }
    }

    const edges = doc.edges.filter((edge) => expanded.has(edge.source.nodeId) && expanded.has(edge.target.nodeId))
    for (const edge of edges) {
      const sourceId = idMap.get(edge.source.nodeId)
      const targetId = idMap.get(edge.target.nodeId)
      if (!sourceId || !targetId) continue
      const payload = buildEdgeCopy(edge, sourceId, targetId)
      await deps.edge.create(payload)
    }
  })

  if (createdIds.length) {
    deps.selection.select(createdIds, 'replace')
  }
}

export const createShortcutCommandHandlers = (deps: ShortcutCommandDeps) => {
  return {
    'selection.selectAll': () => {
      const ids = deps.getSelectableNodeIds()
      deps.selection.select(ids, 'replace')
    },
    'selection.clear': () => {
      deps.selection.clear()
    },
    'selection.delete': () => {
      void deleteSelection(deps)
    },
    'selection.duplicate': () => {
      void duplicateSelection(deps)
    },
    'group.createFromSelection': () => {
      void createGroupFromSelection(deps)
    },
    'group.ungroupSelection': () => {
      void ungroupSelection(deps)
    },
    'history.undo': () => {
      deps.history.undo()
    },
    'history.redo': () => {
      deps.history.redo()
    }
  }
}

export const registerShortcutCommandHandlers = (
  core: Core,
  handlers: ReturnType<typeof createShortcutCommandHandlers>
) => {
  const unregisters = Object.entries(handlers).map(([name, handler]) => core.registries.commands.register(name, handler))

  return () => {
    unregisters.forEach((unregister) => unregister())
  }
}
