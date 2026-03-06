import type { InternalInstance } from '@engine-types/instance/engine'
import type { Commands } from '@engine-types/command/api'
import type { SelectionMode } from '@engine-types/state/model'
import { applySelection } from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'

type SelectionDeps = {
  instance: Pick<InternalInstance, 'state' | 'read'>
}

export const createSelectionCommands = ({
  instance
}: SelectionDeps): Commands['selection'] => {
  const state = instance.state
  const getSelectableNodeIds = (): NodeId[] =>
    [...instance.read.projection.node.ids]
  const getSelectedNodeIds = (): NodeId[] =>
    Array.from(instance.state.read('selection').selectedNodeIds)

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

  return {
    getSelectedNodeIds,
    select,
    toggle,
    selectAll,
    clear
  }
}
