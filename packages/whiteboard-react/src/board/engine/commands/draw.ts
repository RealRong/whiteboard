import type { Editor } from '../../types'
import type { Tool } from '../../../tool/types'
import type { DrawPreferencesState } from '../../local/state/draw'
import {
  isDrawBrushKind
} from '../../../tool/model'
import {
  readDrawSlot
} from '../../../features/draw/model'

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
