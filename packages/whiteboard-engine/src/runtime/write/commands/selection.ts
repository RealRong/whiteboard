import type { SelectionMode } from '@engine-types/state'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  Document,
  EdgeId,
  Node,
  NodeId
} from '@whiteboard/core/types'
import { createEdgeDuplicateInput } from '@whiteboard/core/edge'
import { applySelection, createNodeDuplicateInput, expandNodeSelection } from '@whiteboard/core/node'
import { DEFAULT_TUNING } from '../../../config'

type Options = {
  instance: Pick<InternalInstance, 'commands' | 'state' | 'document' | 'read'>
}

export type SelectionCommandsApi = {
  readonly name: 'Selection'
  getSelectedNodeIds: () => NodeId[]
  select: (ids: NodeId[], mode?: SelectionMode) => void
  toggle: (ids: NodeId[]) => void
  selectAll: () => void
  clear: () => void
  groupSelected: () => Promise<void>
  ungroupSelected: () => Promise<void>
  deleteSelected: () => Promise<void>
  duplicateSelected: () => Promise<void>
}

const getCreatedNodeId = (result: DispatchResult, type?: string) => {
  if (!result.ok) return undefined
  const op = result.changes.operations.find(
    (operation): operation is { type: 'node.create'; node: Node } =>
      operation.type === 'node.create' && operation.node && (!type || operation.node.type === type)
  )
  return op?.node?.id
}

export const createSelectionCommands = ({
  instance
}: Options): SelectionCommandsApi => {
  const state = instance.state

  const getDocument = (): Document => instance.document.get()

  const getSelectableNodeIds = (): NodeId[] =>
    instance.read.get.nodeIds()

  const getSelectedNodeIds = (): NodeId[] =>
    Array.from(instance.state.read('selection').selectedNodeIds)

  const getSelectedEdgeId = (): EdgeId | undefined =>
    instance.state.read('selection').selectedEdgeId

  const select = (ids: NodeId[], mode: SelectionMode = 'replace') => {
    state.batch(() => {
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        mode,
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
      }))
    })
  }

  const toggle = (ids: NodeId[]) => {
    state.batch(() => {
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        mode: 'toggle',
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
      }))
    })
  }

  const selectAll = () => {
    const ids = getSelectableNodeIds()
    select(ids, 'replace')
  }

  const clear = () => {
    state.batch(() => {
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        selectedNodeIds: new Set()
      }))
    })
  }

  const groupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (selectedNodeIds.length < 2) return

    const result = await instance.commands.group.create(selectedNodeIds)
    const groupId = getCreatedNodeId(result, 'group')
    if (!groupId) return
    select([groupId], 'replace')
  }

  const ungroupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = getDocument()
    const groups = doc.nodes.filter((node) => node.type === 'group' && selectedNodeIds.includes(node.id))
    if (!groups.length) return

    for (const group of groups) {
      await instance.commands.group.ungroup(group.id)
    }
    clear()
  }

  const deleteSelected = async () => {
    const selectedEdgeId = getSelectedEdgeId()
    if (selectedEdgeId) {
      await instance.commands.edge.delete([selectedEdgeId])
      instance.commands.edge.select(undefined)
      return
    }

    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = getDocument()
    const { expandedIds } = expandNodeSelection(doc.nodes, selectedNodeIds)
    const ids = Array.from(expandedIds)
    const edgeIds = doc.edges
      .filter((edge) => expandedIds.has(edge.source.nodeId) || expandedIds.has(edge.target.nodeId))
      .map((edge) => edge.id)

    if (edgeIds.length) {
      await instance.commands.edge.delete(edgeIds)
    }
    await instance.commands.node.delete(ids)
    clear()
  }

  const duplicateSelected = async () => {
    const selectedIds = getSelectedNodeIds()
    if (!selectedIds.length) return

    const doc = getDocument()
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
      const result = await instance.commands.node.create(payload)
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
      await instance.commands.edge.create(payload)
    }

    if (createdIds.length) {
      select(createdIds, 'replace')
    }
  }

  return {
    name: 'Selection',
    getSelectedNodeIds,
    select,
    toggle,
    selectAll,
    clear,
    groupSelected,
    ungroupSelected,
    deleteSelected,
    duplicateSelected
  }
}
