import type { State } from '@engine-types/instance/state'
import type { ShortcutContext } from '@engine-types/shortcuts'

type ShortcutContextReaderOptions = {
  readState: State['read']
  platform: ShortcutContext['platform']
}

export const createShortcutContextReader = ({
  readState,
  platform
}: ShortcutContextReaderOptions) => {
  return (): ShortcutContext => {
    const interaction = readState('interaction')
    const tool = readState('tool')
    const selection = readState('selection')
    const selectedEdgeId = readState('edgeSelection')
    const edgeConnect = readState('edgeConnect')
    const selectedNodeIds = Array.from(selection.selectedNodeIds)

    return {
      platform,
      focus: interaction.focus,
      tool: { active: tool },
      selection: {
        count: selectedNodeIds.length,
        hasSelection: selectedNodeIds.length > 0,
        selectedNodeIds,
        selectedEdgeId
      },
      hover: interaction.hover,
      pointer: {
        ...interaction.pointer,
        isDragging: interaction.pointer.isDragging || selection.isSelecting || edgeConnect.isConnecting
      },
      viewport: {
        zoom: readState('viewport').zoom
      }
    }
  }
}
