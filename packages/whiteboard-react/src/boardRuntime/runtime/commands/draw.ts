import type { Editor } from '../../types/editor'
import type { Tool } from '../../types/tool'
import type { DrawPreferencesState } from '../state/draw'
import {
  isDrawBrushKind
} from '../../tool/model'
import {
  readDrawSlot
} from '../../draw/model'

export const createDrawCommands = ({
  tool,
  drawPreferences
}: {
  tool: {
    get: () => Tool
  }
  drawPreferences: DrawPreferencesState
}): Editor['commands']['draw'] => ({
  slot: (slot) => {
    const current = tool.get()
    if (current.type !== 'draw' || !isDrawBrushKind(current.kind)) {
      return
    }

    drawPreferences.commands.slot(current.kind, slot)
  },
  patch: (patch) => {
    const current = tool.get()
    if (current.type !== 'draw' || !isDrawBrushKind(current.kind)) {
      return
    }

    drawPreferences.commands.patch(
      current.kind,
      readDrawSlot(drawPreferences.store.get(), current.kind),
      patch
    )
  }
})
