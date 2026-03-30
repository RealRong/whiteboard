import type { Editor } from '../../types/editor'
import type { DrawFeatureState } from '../../types/internal/editor'
import type { Tool } from '../tool'
import {
  isDrawBrushKind
} from '../tool'
import {
  readDrawSlot
} from '../draw'

export const createDrawCommands = ({
  tool,
  draw
}: {
  tool: {
    get: () => Tool
  }
  draw: DrawFeatureState
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
