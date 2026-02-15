import type { Instance } from '@engine-types/instance'
import {
  createSelectionCallbacksBinding,
  createSelectionBoxWindowBinding,
  type SelectionBoxWindowBinding,
  type SelectionCallbacksBinding
} from '../../bindings'
import type { SelectionBoxSessionRuntime } from '..'

type Options = {
  instance: Instance
  getSelectionBox: () => SelectionBoxSessionRuntime
}

export type SelectionInputBindings = {
  selectionBoxWindowBinding: SelectionBoxWindowBinding
  selectionCallbacksBinding: SelectionCallbacksBinding
}

export const createSelectionInputBindings = ({
  instance,
  getSelectionBox
}: Options): SelectionInputBindings => {
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
