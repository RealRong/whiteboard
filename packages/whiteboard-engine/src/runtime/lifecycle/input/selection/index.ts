import type { Instance } from '@engine-types/instance'
import {
  createSelectionCallbacks,
  createSelectionBox,
  type SelectionBoxBinding,
  type SelectionCallbacksBinding
} from '../../bindings'
import type { SelectionBoxSession } from '..'

type Options = {
  instance: Instance
  getSelectionBox: () => SelectionBoxSession
}

export type SelectionBindings = {
  selectionBox: SelectionBoxBinding
  selectionCallbacks: SelectionCallbacksBinding
}

export const createSelection = ({
  instance,
  getSelectionBox
}: Options): SelectionBindings => {
  return {
    selectionBox: createSelectionBox({
      events: instance.runtime.events,
      getSelectionBox
    }),
    selectionCallbacks: createSelectionCallbacks({
      state: instance.state
    })
  }
}
