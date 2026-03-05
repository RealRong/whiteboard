import type { InternalInstance } from '@engine-types/instance/engine'
import type {
  SelectionMode
} from '@engine-types/state/model'
import type {
  WriteCommandMap
} from '@engine-types/command/api'
import type {
  SelectionCommandsApi
} from '@engine-types/write/commands'
import {
  applySelection
} from '@whiteboard/core/node'
import type {
  DispatchResult,
  EdgeId,
  NodeId
} from '@whiteboard/core/types'
import type { Apply } from '../stages/plan/draft'

type SelectionCommand = WriteCommandMap['selection']
type SelectionWriteValue = {
  selectedNodeIds?: NodeId[]
}

const readSelectedNodeIdsFromResult = (result: DispatchResult): NodeId[] => {
  if (!result.ok) return []
  if (!result.value || typeof result.value !== 'object') return []
  const value = result.value as SelectionWriteValue
  return Array.isArray(value.selectedNodeIds)
    ? value.selectedNodeIds
    : []
}

export const selection = ({
  instance,
  apply
}: {
  instance: Pick<InternalInstance, 'state' | 'read'>
  apply: Apply
}): SelectionCommandsApi => {
  const state = instance.state
  const run = (command: SelectionCommand) =>
    apply({
      domain: 'selection',
      command,
      source: 'ui'
    })
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

    const result = await run({
      type: 'group',
      selectedNodeIds
    })
    const nextSelectedNodeIds = readSelectedNodeIdsFromResult(result)
    if (!nextSelectedNodeIds.length) return
    select(nextSelectedNodeIds, 'replace')
  }

  const ungroupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const result = await run({
      type: 'ungroup',
      selectedNodeIds
    })
    if (!result.ok) return
    clear()
  }

  const deleteSelected = async () => {
    const selectedEdgeId = getSelectedEdgeId()
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedEdgeId && !selectedNodeIds.length) return

    const result = await run({
      type: 'delete',
      selectedNodeIds,
      selectedEdgeId
    })
    if (!result.ok) return

    if (selectedEdgeId) {
      state.batch(() => {
        state.write('selection', (prev) => ({
          ...prev,
          selectedEdgeId: undefined
        }))
      })
      return
    }

    const nextSelectedNodeIds = readSelectedNodeIdsFromResult(result)
    if (!nextSelectedNodeIds.length) {
      clear()
      return
    }
    select(nextSelectedNodeIds, 'replace')
  }

  const duplicateSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const result = await run({
      type: 'duplicate',
      selectedNodeIds
    })
    const nextSelectedNodeIds = readSelectedNodeIdsFromResult(result)
    if (!nextSelectedNodeIds.length) return
    select(nextSelectedNodeIds, 'replace')
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
