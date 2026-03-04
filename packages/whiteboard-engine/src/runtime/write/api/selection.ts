import type { InternalInstance } from '@engine-types/instance/engine'
import type {
  SelectionMode
} from '@engine-types/state/model'
import type {
  EdgeCommandsApi,
  NodeCommandsApi,
  SelectionCommandsApi
} from '@engine-types/write/commands'
import {
  createEdgeDuplicateInput
} from '@whiteboard/core/edge'
import {
  applySelection,
  createNodeDuplicateInput,
  expandNodeSelection
} from '@whiteboard/core/node'
import type {
  DispatchResult,
  Document,
  EdgeId,
  Node,
  NodeId
} from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../../config'

const getCreatedNodeId = (result: DispatchResult, type?: string) => {
  if (!result.ok) return undefined
  const operation = result.changes.operations.find(
    (item): item is { type: 'node.create'; node: Node } =>
      item.type === 'node.create' && item.node && (!type || item.node.type === type)
  )
  return operation?.node?.id
}

export type SelectionWriteCommands = {
  node: Pick<NodeCommandsApi, 'create' | 'delete' | 'createGroup' | 'ungroup'>
  edge: Pick<EdgeCommandsApi, 'create' | 'delete' | 'select'>
}

export const selection = ({
  instance,
  commands
}: {
  instance: Pick<InternalInstance, 'state' | 'document' | 'read'>
  commands: SelectionWriteCommands
}): SelectionCommandsApi => {
  const state = instance.state
  const writeCommands = commands
  const readDoc = (): Document => instance.document.get()
  const getSelectableNodeIds = (): NodeId[] =>
    [...instance.read.projection.node.ids]
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

    const result = await writeCommands.node.createGroup(selectedNodeIds)
    const groupId = getCreatedNodeId(result, 'group')
    if (!groupId) return
    select([groupId], 'replace')
  }

  const ungroupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = readDoc()
    const groups = doc.nodes.filter(
      (item) => item.type === 'group' && selectedNodeIds.includes(item.id)
    )
    if (!groups.length) return

    for (const group of groups) {
      await writeCommands.node.ungroup(group.id)
    }
    clear()
  }

  const deleteSelected = async () => {
    const selectedEdgeId = getSelectedEdgeId()
    if (selectedEdgeId) {
      await writeCommands.edge.delete([selectedEdgeId])
      writeCommands.edge.select(undefined)
      return
    }

    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = readDoc()
    const { expandedIds } = expandNodeSelection(doc.nodes, selectedNodeIds)
    const ids = Array.from(expandedIds)
    const edgeIds = doc.edges
      .filter(
        (item) =>
          expandedIds.has(item.source.nodeId)
          || expandedIds.has(item.target.nodeId)
      )
      .map((item) => item.id)

    if (edgeIds.length) {
      await writeCommands.edge.delete(edgeIds)
    }
    await writeCommands.node.delete(ids)
    clear()
  }

  const duplicateSelected = async () => {
    const selectedIds = getSelectedNodeIds()
    if (!selectedIds.length) return

    const doc = readDoc()
    const { expandedIds, nodeById } = expandNodeSelection(doc.nodes, selectedIds)
    const nodes = Array.from(expandedIds)
      .map((id) => nodeById.get(id))
      .filter((item): item is Node => Boolean(item))

    const depthCache = new Map<NodeId, number>()
    const getDepth = (item: Node): number => {
      if (!item.parentId || !expandedIds.has(item.parentId)) return 0
      const cached = depthCache.get(item.id)
      if (cached !== undefined) return cached
      const parent = nodeById.get(item.parentId)
      const depth = parent ? getDepth(parent) + 1 : 0
      depthCache.set(item.id, depth)
      return depth
    }

    nodes.sort((a, b) => getDepth(a) - getDepth(b))

    const idMap = new Map<NodeId, NodeId>()
    const createdIds: NodeId[] = []
    const offset = DEFAULT_TUNING.shortcuts.duplicateOffset

    for (const item of nodes) {
      const parentId =
        item.parentId && idMap.has(item.parentId)
          ? idMap.get(item.parentId)
          : item.parentId
      const payload = createNodeDuplicateInput(item, parentId, offset)
      const result = await writeCommands.node.create(payload)
      const createdId = getCreatedNodeId(result)
      if (createdId) {
        idMap.set(item.id, createdId)
        createdIds.push(createdId)
      }
    }

    const edges = doc.edges.filter(
      (item) =>
        expandedIds.has(item.source.nodeId)
        && expandedIds.has(item.target.nodeId)
    )
    for (const item of edges) {
      const sourceId = idMap.get(item.source.nodeId)
      const targetId = idMap.get(item.target.nodeId)
      if (!sourceId || !targetId) continue
      const payload = createEdgeDuplicateInput(item, sourceId, targetId)
      await writeCommands.edge.create(payload)
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
