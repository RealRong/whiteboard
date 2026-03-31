import {
  applySelectionTarget,
  isSelectionTargetEqual,
  normalizeSelectionTarget,
  type SelectionTarget
} from '@whiteboard/core/selection'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types/editor'
import type { EditMutate } from '../state/edit'
import type { SelectionState } from '../state/selection'

export const createSelectionCommands = ({
  engine,
  edit,
  selection
}: {
  engine: EngineInstance
  edit: Pick<EditMutate, 'clear'>
  selection: SelectionState
}): Editor['commands']['selection'] => {
  const writeSelection = (
    next: SelectionTarget,
    write: () => void
  ) => {
    if (isSelectionTargetEqual(selection.source.get(), next)) {
      return
    }

    edit.clear()
    write()
  }

  return {
    replace: (input) => {
      writeSelection(normalizeSelectionTarget(input), () => {
        selection.mutate.replace(input)
      })
    },
    add: (input) => {
      writeSelection(
        applySelectionTarget(selection.source.get(), input, 'add'),
        () => {
          selection.mutate.add(input)
        }
      )
    },
    remove: (input) => {
      writeSelection(
        applySelectionTarget(selection.source.get(), input, 'subtract'),
        () => {
          selection.mutate.remove(input)
        }
      )
    },
    toggle: (input) => {
      writeSelection(
        applySelectionTarget(selection.source.get(), input, 'toggle'),
        () => {
          selection.mutate.toggle(input)
        }
      )
    },
    selectAll: () => {
      const next = normalizeSelectionTarget({
        nodeIds: [...engine.read.node.list.get()],
        edgeIds: [...engine.read.edge.list.get()]
      })
      writeSelection(next, () => {
        selection.mutate.replace(next)
      })
    },
    clear: () => {
      writeSelection(normalizeSelectionTarget({}), () => {
        selection.mutate.clear()
      })
    }
  }
}
