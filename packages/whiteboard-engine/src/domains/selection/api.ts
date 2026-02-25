import type { Commands } from '@engine-types/commands'
import type { SelectionDomainApi, SelectionStateReader } from '@engine-types/domains'
import type { InputSessionContext } from '@engine-types/input'
import type { View } from '@engine-types/instance/view'

type Options = {
  commands: Pick<Commands, 'selection'>
  selectionInput: InputSessionContext['selectionInput']
  state: SelectionStateReader
  view: View
}

export const createSelectionDomainApi = ({
  commands,
  selectionInput,
  state,
  view
}: Options): SelectionDomainApi => ({
  commands: commands.selection,
  interaction: {
    box: selectionInput.box
  },
  query: {
    get: () => state.read('selection'),
    getSelectedNodeIds: commands.selection.getSelectedNodeIds,
    getSelectedEdgeId: () => state.read('selection').selectedEdgeId,
    getMode: () => state.read('selection').mode
  },
  view: {
    getEdgeSelection: () => view.getState().edges.selection,
    subscribe: view.subscribe
  }
})
