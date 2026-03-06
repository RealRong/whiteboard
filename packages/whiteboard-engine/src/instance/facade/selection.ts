import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { Write } from '@engine-types/write/runtime'
import type { SelectionMode } from '@engine-types/state/model'
import { applySelection } from '@whiteboard/core/node'
import type {
  DispatchResult,
  EdgeId,
  NodeId,
  Operation
} from '@whiteboard/core/types'

type SelectionWriteValue = {
  selectedNodeIds?: NodeId[]
}

type SelectionDeps = {
  instance: Pick<InternalInstance, 'state' | 'read'>
  write: Pick<Write, 'apply'>
}

const readSelectedNodeIdsFromResult = (result: DispatchResult): NodeId[] => {
  if (!result.ok) return []
  if (!result.value || typeof result.value !== 'object') return []
  const value = result.value as SelectionWriteValue
  return Array.isArray(value.selectedNodeIds)
    ? value.selectedNodeIds
    : []
}

const readCreatedNodeIds = (result: DispatchResult): NodeId[] => {
  if (!result.ok) return []
  return result.changes.operations
    .filter((operation): operation is Extract<Operation, { type: 'node.create' }> =>
      operation.type === 'node.create'
    )
    .map((operation) => operation.node.id)
}

export const createSelectionCommands = ({
  instance,
  write
}: SelectionDeps): Commands['selection'] => {
  const state = instance.state
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
        selectedNodeIds: new Set(),
        mode: 'replace'
      }))
    })
  }

  const groupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (selectedNodeIds.length < 2) return

    const result = await write.apply({
      domain: 'node',
      command: {
        type: 'group.create',
        ids: selectedNodeIds
      },
      source: 'ui'
    })
    const nextSelectedNodeIds = readSelectedNodeIdsFromResult(result)
    if (!nextSelectedNodeIds.length) return
    select(nextSelectedNodeIds, 'replace')
  }

  const ungroupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const result = await write.apply({
      domain: 'node',
      command: {
        type: 'group.ungroupMany',
        ids: selectedNodeIds
      },
      source: 'ui'
    })
    if (!result.ok) return
    clear()
  }

  const deleteSelected = async () => {
    const selectedEdgeId = getSelectedEdgeId()
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedEdgeId && !selectedNodeIds.length) return

    if (selectedEdgeId) {
      const result = await write.apply({
        domain: 'edge',
        command: {
          type: 'delete',
          ids: [selectedEdgeId]
        },
        source: 'ui'
      })
      if (!result.ok) return
      state.batch(() => {
        state.write('selection', (prev) => ({
          ...prev,
          selectedEdgeId: undefined
        }))
      })
      return
    }

    const result = await write.apply({
      domain: 'node',
      command: {
        type: 'deleteCascade',
        ids: selectedNodeIds
      },
      source: 'ui'
    })
    if (!result.ok) return
    clear()
  }

  const duplicateSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const result = await write.apply({
      domain: 'node',
      command: {
        type: 'duplicate',
        ids: selectedNodeIds
      },
      source: 'ui'
    })
    const nextSelectedNodeIds = readSelectedNodeIdsFromResult(result)
    if (nextSelectedNodeIds.length) {
      select(nextSelectedNodeIds, 'replace')
      return
    }

    const fallbackSelectedNodeIds = readCreatedNodeIds(result)
    if (!fallbackSelectedNodeIds.length) return
    select(fallbackSelectedNodeIds, 'replace')
  }

  return {
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
