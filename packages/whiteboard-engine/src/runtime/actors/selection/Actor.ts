import type { SelectionMode } from '@engine-types/state'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  Document,
  EdgeId,
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import { createEdgeDuplicateInput } from '@whiteboard/core/edge'
import { createNodeDuplicateInput, expandNodeSelection } from '@whiteboard/core/node'
import { DEFAULT_TUNING } from '../../../config'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

type ActorOptions = {
  instance: Pick<InternalInstance, 'commands' | 'state' | 'projection' | 'document' | 'emit'>
}

type EdgeSelectionValue = EdgeId | undefined

const getCreatedNodeId = (result: DispatchResult, type?: string) => {
  if (!result.ok) return undefined
  const op = result.changes.operations.find(
    (operation): operation is { type: 'node.create'; node: Node } =>
      operation.type === 'node.create' && operation.node && (!type || operation.node.type === type)
  )
  return op?.node?.id
}

const isSameNodeIds = (left: NodeId[], right: NodeId[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const applySelection = (
  prevSelectedIds: Set<NodeId>,
  ids: NodeId[],
  mode: SelectionMode
): Set<NodeId> => {
  if (mode === 'replace') {
    return new Set(ids)
  }

  const next = new Set(prevSelectedIds)
  if (mode === 'add') {
    ids.forEach((id) => next.add(id))
    return next
  }

  if (mode === 'subtract') {
    ids.forEach((id) => next.delete(id))
    return next
  }

  ids.forEach((id) => {
    if (next.has(id)) {
      next.delete(id)
      return
    }
    next.add(id)
  })
  return next
}

export class Actor {
  readonly name = 'Selection'
  private readonly instance: ActorOptions['instance']

  private readonly selectionEmitter: StateWatchEmitter<NodeId[]>
  private readonly edgeSelectionEmitter: StateWatchEmitter<EdgeSelectionValue>

  constructor({ instance }: ActorOptions) {
    this.instance = instance
    const state = instance.state
    this.selectionEmitter = new StateWatchEmitter({
      state,
      keys: ['selection'],
      read: () => Array.from(state.read('selection').selectedNodeIds),
      equals: isSameNodeIds,
      clone: (value) => [...value],
      emit: (nodeIds) => instance.emit('selection.changed', { nodeIds })
    })
    this.edgeSelectionEmitter = new StateWatchEmitter({
      state,
      keys: ['selection'],
      read: () => state.read('selection').selectedEdgeId,
      equals: (left, right) => left === right,
      emit: (edgeId) => instance.emit('edge.selection.changed', { edgeId })
    })
  }

  start = () => {
    this.selectionEmitter.start()
    this.edgeSelectionEmitter.start()
  }

  stop = () => {
    this.selectionEmitter.stop()
    this.edgeSelectionEmitter.stop()
  }

  private getDocument = (): Document => this.instance.document.get()

  private getSelectableNodeIds = (): NodeId[] =>
    this.instance.projection.getSnapshot().nodes.canvas.map((canvasNode) => canvasNode.id)

  getSelectedNodeIds = (): NodeId[] =>
    Array.from(this.instance.state.read('selection').selectedNodeIds)

  private getSelectedEdgeId = (): EdgeId | undefined =>
    this.instance.state.read('selection').selectedEdgeId

  select = (ids: NodeId[], mode: SelectionMode = 'replace') => {
    const { state } = this.instance
    state.batch(() => {
      state.write('routingDrag', {})
      state.write('interactionSession', (prev) => {
        if (prev.active?.kind !== 'routingDrag') return prev
        return {}
      })
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        groupHovered: undefined,
        mode,
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
      }))
    })
  }

  toggle = (ids: NodeId[]) => {
    const { state } = this.instance
    state.batch(() => {
      state.write('routingDrag', {})
      state.write('interactionSession', (prev) => {
        if (prev.active?.kind !== 'routingDrag') return prev
        return {}
      })
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        groupHovered: undefined,
        mode: 'toggle',
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
      }))
    })
  }

  selectAll = () => {
    const ids = this.getSelectableNodeIds()
    this.select(ids, 'replace')
  }

  clear = () => {
    const { state } = this.instance
    state.batch(() => {
      state.write('routingDrag', {})
      state.write('interactionSession', (prev) => {
        if (prev.active?.kind !== 'routingDrag') return prev
        return {}
      })
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        groupHovered: undefined,
        selectedNodeIds: new Set(),
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    })
  }

  beginBox = (mode: SelectionMode = 'replace') => {
    const { state } = this.instance
    state.batch(() => {
      state.write('routingDrag', {})
      state.write('interactionSession', (prev) => {
        if (prev.active?.kind !== 'routingDrag') return prev
        return {}
      })
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        groupHovered: undefined,
        mode,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    })
  }

  updateBox = (selectionRect: Rect, selectionRectWorld?: Rect) => {
    this.instance.state.write('selection', (prev) => ({
      ...prev,
      isSelecting: true,
      selectionRect,
      selectionRectWorld
    }))
  }

  endBox = () => {
    this.instance.state.write('selection', (prev) => ({
      ...prev,
      isSelecting: false,
      selectionRect: undefined,
      selectionRectWorld: undefined
    }))
  }

  groupSelected = async () => {
    const selectedNodeIds = this.getSelectedNodeIds()
    if (selectedNodeIds.length < 2) return

    const result = await this.instance.commands.group.create(selectedNodeIds)
    const groupId = getCreatedNodeId(result, 'group')
    if (!groupId) return
    this.select([groupId], 'replace')
  }

  ungroupSelected = async () => {
    const selectedNodeIds = this.getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = this.getDocument()
    const groups = doc.nodes.filter((node) => node.type === 'group' && selectedNodeIds.includes(node.id))
    if (!groups.length) return

    for (const group of groups) {
      await this.instance.commands.group.ungroup(group.id)
    }
    this.clear()
  }

  deleteSelected = async () => {
    const selectedEdgeId = this.getSelectedEdgeId()
    if (selectedEdgeId) {
      await this.instance.commands.edge.delete([selectedEdgeId])
      this.instance.commands.edge.select(undefined)
      return
    }

    const selectedNodeIds = this.getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = this.getDocument()
    const { expandedIds } = expandNodeSelection(doc.nodes, selectedNodeIds)
    const ids = Array.from(expandedIds)
    const edgeIds = doc.edges
      .filter((edge) => expandedIds.has(edge.source.nodeId) || expandedIds.has(edge.target.nodeId))
      .map((edge) => edge.id)

    if (edgeIds.length) {
      await this.instance.commands.edge.delete(edgeIds)
    }
    await this.instance.commands.node.delete(ids)
    this.clear()
  }

  duplicateSelected = async () => {
    const selectedIds = this.getSelectedNodeIds()
    if (!selectedIds.length) return

    const doc = this.getDocument()
    const { expandedIds, nodeById } = expandNodeSelection(doc.nodes, selectedIds)
    const nodes = Array.from(expandedIds)
      .map((id) => nodeById.get(id))
      .filter((node): node is Node => Boolean(node))

    const depthCache = new Map<NodeId, number>()
    const getDepth = (node: Node): number => {
      if (!node.parentId || !expandedIds.has(node.parentId)) return 0
      const cached = depthCache.get(node.id)
      if (cached !== undefined) return cached
      const parent = nodeById.get(node.parentId)
      const depth = parent ? getDepth(parent) + 1 : 0
      depthCache.set(node.id, depth)
      return depth
    }

    nodes.sort((a, b) => getDepth(a) - getDepth(b))

    const idMap = new Map<NodeId, NodeId>()
    const createdIds: NodeId[] = []
    const offset = DEFAULT_TUNING.shortcuts.duplicateOffset

    for (const node of nodes) {
      const parentId = node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : node.parentId
      const payload = createNodeDuplicateInput(node, parentId, offset)
      const result = await this.instance.commands.node.create(payload)
      const createdId = getCreatedNodeId(result)
      if (createdId) {
        idMap.set(node.id, createdId)
        createdIds.push(createdId)
      }
    }

    const edges = doc.edges.filter((edge) => expandedIds.has(edge.source.nodeId) && expandedIds.has(edge.target.nodeId))
    for (const edge of edges) {
      const sourceId = idMap.get(edge.source.nodeId)
      const targetId = idMap.get(edge.target.nodeId)
      if (!sourceId || !targetId) continue
      const payload = createEdgeDuplicateInput(edge, sourceId, targetId)
      await this.instance.commands.edge.create(payload)
    }

    if (createdIds.length) {
      this.select(createdIds, 'replace')
    }
  }
}
