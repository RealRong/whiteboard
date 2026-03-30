import {
  createDerivedStore,
  type ReadStore
} from '@whiteboard/engine'
import type { SelectionSummary } from '@whiteboard/core/selection'
import type { SelectionMenuView } from '../../../types/public/context'
import type { SelectionMenuHost } from './actions'
import { readSelectionMenuView } from './view'

export const createSelectionMenuRead = ({
  editor,
  selection
}: {
  editor: SelectionMenuHost
  selection: ReadStore<SelectionSummary>
}): ReadStore<SelectionMenuView | null> => createDerivedStore({
  get: (read) => readSelectionMenuView({
    editor,
    nodes: read(selection).items.nodes
  }) ?? null
})
