import type { State } from '@engine-types/instance/state'
import type { ShortcutContext } from '@engine-types/shortcuts'
import type { ViewSnapshot } from '@engine-types/instance/view'
import type { Viewport } from '@whiteboard/core'

type CommonViewDerivationOptions = {
  readState: State['read']
  platform: ShortcutContext['platform']
}

export const COMMON_VIEW_DERIVATION_DEPS = {
  viewportTransform: ['viewport'] as const,
  shortcutContext: ['interaction', 'tool', 'selection', 'edgeSelection', 'edgeConnect', 'viewport'] as const
}

export const createCommonViewDerivations = ({
  readState,
  platform
}: CommonViewDerivationOptions) => {
  const toViewportTransformView = (viewport: Viewport): ViewSnapshot['viewport.transform'] => {
    const zoom = viewport.zoom
    return {
      center: viewport.center,
      zoom,
      transform: `translate(50%, 50%) scale(${zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      cssVars: {
        '--wb-zoom': `${zoom}`
      }
    }
  }

  const viewportTransform = (): ViewSnapshot['viewport.transform'] =>
    toViewportTransformView(readState('viewport'))

  const shortcutContext = (): ViewSnapshot['shortcut.context'] => {
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

  return {
    viewportTransform,
    shortcutContext
  }
}
