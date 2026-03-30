import { isEdgeInFrameScope } from '@whiteboard/core/document'
import {
  applySelectionTarget,
  isSelectionTargetEqual,
  normalizeSelectionTarget,
  type SelectionTarget
} from '@whiteboard/core/selection'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types/public/editor'
import type { EditCommands } from '../edit'
import type { FrameState } from '../frame'
import type { SelectionState } from '../selection/store'

export const createSelectionCommands = ({
  engine,
  edit,
  selection,
  frame
}: {
  engine: EngineInstance
  edit: Pick<EditCommands, 'clear'>
  selection: SelectionState
  frame: FrameState
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
        selection.commands.replace(input)
      })
    },
    add: (input) => {
      writeSelection(
        applySelectionTarget(selection.source.get(), input, 'add'),
        () => {
          selection.commands.add(input)
        }
      )
    },
    remove: (input) => {
      writeSelection(
        applySelectionTarget(selection.source.get(), input, 'subtract'),
        () => {
          selection.commands.remove(input)
        }
      )
    },
    toggle: (input) => {
      writeSelection(
        applySelectionTarget(selection.source.get(), input, 'toggle'),
        () => {
          selection.commands.toggle(input)
        }
      )
    },
    selectAll: () => {
      const activeFrame = frame.store.get()
      const next = normalizeSelectionTarget({
        nodeIds:
          activeFrame.id
            ? [...activeFrame.ids]
            : [...engine.read.node.list.get()],
        edgeIds:
          activeFrame.id
            ? engine.read.edge.list.get().filter((edgeId) => {
              const edge = engine.read.edge.item.get(edgeId)?.edge
              return edge ? isEdgeInFrameScope(activeFrame, edge) : false
            })
            : [...engine.read.edge.list.get()]
      })
      writeSelection(next, () => {
        selection.commands.replace(next)
      })
    },
    clear: () => {
      writeSelection(normalizeSelectionTarget({}), () => {
        selection.commands.clear()
      })
    }
  }
}
