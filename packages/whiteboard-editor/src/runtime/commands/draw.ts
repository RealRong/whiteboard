import type { Editor } from '../editor/types'
import type { Tool } from '../tool'
import {
  isDrawBrushKind
} from '../tool'
import {
  createDrawState,
  readDrawSlot
} from '../../features/draw/state'

export const createDrawCommands = ({
  tool,
  draw
}: {
  tool: {
    get: () => Tool
  }
  draw: ReturnType<typeof createDrawState>
}): Editor['commands']['draw'] => ({
  slot: (slot) => {
    const current = tool.get()
    if (current.type !== 'draw' || !isDrawBrushKind(current.kind)) {
      return
    }

    draw.commands.slot(current.kind, slot)
  },
  patch: (patch) => {
    const current = tool.get()
    if (current.type !== 'draw' || !isDrawBrushKind(current.kind)) {
      return
    }

    draw.commands.patch(
      current.kind,
      readDrawSlot(draw.store.get(), current.kind),
      patch
    )
  }
})
