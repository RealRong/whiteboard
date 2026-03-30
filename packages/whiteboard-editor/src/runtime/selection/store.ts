import {
  EMPTY_SELECTION_TARGET,
  applySelectionTarget,
  isSelectionTargetEqual,
  normalizeSelectionTarget,
  type SelectionInput,
  type SelectionTarget
} from '@whiteboard/core/selection'
import {
  createValueStore,
  type ValueStore
} from '@whiteboard/engine'
import type { SelectionCommands } from '../../types/internal/selection'

export type SelectionStore = {
  source: ValueStore<SelectionTarget>
  commands: SelectionCommands
}

export type SelectionState = SelectionStore

export const createSelectionState = (): SelectionState => {
  const source = createValueStore<SelectionTarget>(EMPTY_SELECTION_TARGET, {
    isEqual: isSelectionTargetEqual
  })
  const readSource = () => source.get()
  const writeSource = (next: SelectionTarget) => {
    if (isSelectionTargetEqual(readSource(), next)) {
      return
    }

    source.set(next)
  }

  return {
    source,
    commands: {
      replace: (input: SelectionInput) => {
        writeSource(normalizeSelectionTarget(input))
      },
      add: (input: SelectionInput) => {
        writeSource(applySelectionTarget(readSource(), input, 'add'))
      },
      remove: (input: SelectionInput) => {
        writeSource(applySelectionTarget(readSource(), input, 'subtract'))
      },
      toggle: (input: SelectionInput) => {
        writeSource(applySelectionTarget(readSource(), input, 'toggle'))
      },
      clear: () => {
        writeSource(EMPTY_SELECTION_TARGET)
      }
    }
  }
}
