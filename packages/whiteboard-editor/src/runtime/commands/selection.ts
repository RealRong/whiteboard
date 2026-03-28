import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../editor/types'
import type { Commands as EditCommands } from '../edit'
import {
  createState as createFrameState,
  hasEdge
} from '../frame'
import {
  applySelectionTarget,
  createState as createSelectionState,
  isSelectionTargetEqual,
  toSelectionTarget
} from '../selection'

export const createSelectionCommands = ({
  engine,
  edit,
  selection,
  frame
}: {
  engine: EngineInstance
  edit: Pick<EditCommands, 'clear'>
  selection: ReturnType<typeof createSelectionState>
  frame: ReturnType<typeof createFrameState>
}): Editor['commands']['selection'] => {
  const writeSelection = (
    next: ReturnType<typeof selection.source.get>,
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
      writeSelection(toSelectionTarget(input), () => {
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
      const next = toSelectionTarget({
        nodeIds:
          activeFrame.id
            ? [...activeFrame.ids]
            : [...engine.read.node.list.get()],
        edgeIds:
          activeFrame.id
            ? engine.read.edge.list.get().filter((edgeId) => {
              const edge = engine.read.edge.item.get(edgeId)?.edge
              return edge ? hasEdge(activeFrame, edge) : false
            })
            : [...engine.read.edge.list.get()]
      })
      writeSelection(next, () => {
        selection.commands.replace(next)
      })
    },
    clear: () => {
      writeSelection(toSelectionTarget({}), () => {
        selection.commands.clear()
      })
    }
  }
}
