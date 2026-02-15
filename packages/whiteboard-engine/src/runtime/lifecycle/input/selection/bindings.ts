import type { WhiteboardInstance } from '@engine-types/instance'
import { createSelectionCallbacksBinding, type SelectionCallbacksBinding } from '../../bindings/bindSelectionCallbacks'
import { createSelectionBoxWindowBinding, type SelectionBoxWindowBinding } from '../../bindings/bindSelectionBoxWindow'
import type { SelectionBoxSessionRuntime } from '../types'

type CreateSelectionInputBindingsOptions = {
  instance: WhiteboardInstance
  getSelectionBox: () => SelectionBoxSessionRuntime
}

export type SelectionInputBindings = {
  selectionBoxWindowBinding: SelectionBoxWindowBinding
  selectionCallbacksBinding: SelectionCallbacksBinding
}

export const createSelectionInputBindings = ({
  instance,
  getSelectionBox
}: CreateSelectionInputBindingsOptions): SelectionInputBindings => {
  return {
    selectionBoxWindowBinding: createSelectionBoxWindowBinding({
      events: instance.runtime.events,
      getSelectionBox
    }),
    selectionCallbacksBinding: createSelectionCallbacksBinding({
      state: instance.state
    })
  }
}
