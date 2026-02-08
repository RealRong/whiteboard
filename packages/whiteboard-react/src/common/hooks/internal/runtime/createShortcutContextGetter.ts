import type { ShortcutContext } from 'types/shortcuts'
import type { WhiteboardInstance } from 'types/instance'
import {
  edgeConnectAtom,
  edgeSelectionAtom,
  interactionAtom,
  nodeSelectionAtom,
  platformAtom,
  toolAtom
} from '../../../state'

export const createShortcutContextGetter = (instance: WhiteboardInstance) => {
  return (): ShortcutContext => {
    const platform = instance.state.get(platformAtom)
    const interaction = instance.state.get(interactionAtom)
    const tool = instance.state.get(toolAtom)
    const selection = instance.state.get(nodeSelectionAtom)
    const selectedEdgeId = instance.state.get(edgeSelectionAtom)
    const edgeConnect = instance.state.get(edgeConnectAtom)
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
        zoom: instance.viewport.getZoom()
      }
    }
  }
}
