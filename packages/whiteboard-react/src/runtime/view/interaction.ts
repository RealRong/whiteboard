import type { NodeId } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../instance'
import { useInternalInstance, useView } from '../hooks'
import type { InteractionSession } from '../instance/interaction/types'
import type { EditorTool } from '../instance/toolState'
import type { Selection } from '../state/selection'

export type InteractionMode =
  | 'idle'
  | 'context-menu'
  | 'toolbar-menu'
  | 'selection-box'
  | 'node-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'

export type InteractionView = {
  showSelectionBox: boolean
  canCanvasSelect: boolean
  canOpenContextMenu: boolean
  canOpenToolbarMenu: boolean
  nodeHandleNodeIds: readonly NodeId[]
  showNodeConnectHandles: boolean
  showNodeToolbar: boolean
  showEdgeControls: boolean
}

const EMPTY_NODE_IDS: readonly NodeId[] = []

const isSameNodeIds = (
  left: readonly NodeId[],
  right: readonly NodeId[]
) => (
  left === right
  || (
    left.length === right.length
    && left.every((nodeId, index) => nodeId === right[index])
  )
)

const resolveInteractionMode = ({
  contextMenuOpen,
  toolbarMenuOpen,
  session
}: {
  contextMenuOpen: boolean
  toolbarMenuOpen: boolean
  session: InteractionSession
}): InteractionMode => {
  if (contextMenuOpen) return 'context-menu'
  if (session.kind === 'edge-connect') return 'edge-connect'
  if (session.kind === 'edge-routing') return 'edge-routing'
  if (session.kind === 'selection-box') return 'selection-box'
  if (session.kind === 'node-transform') return 'node-transform'
  if (session.kind === 'node-drag') return 'node-drag'
  if (toolbarMenuOpen) return 'toolbar-menu'
  return 'idle'
}

const isChromeVisible = (mode: InteractionMode) =>
  mode === 'idle' || mode === 'toolbar-menu'

const resolveInteractionView = ({
  contextMenuOpen,
  toolbarMenuOpen,
  tool,
  nodeIds,
  edgeId,
  session
}: {
  contextMenuOpen: boolean
  toolbarMenuOpen: boolean
  tool: EditorTool
  nodeIds: readonly NodeId[]
  edgeId: Selection['edgeId']
  session: InteractionSession
}): InteractionView => {
  const hasNodeSelection = nodeIds.length > 0
  const hasEdgeSelection = edgeId !== undefined
  const mode = resolveInteractionMode({
    contextMenuOpen,
    toolbarMenuOpen,
    session
  })
  const chromeVisible = isChromeVisible(mode)
  const showNodeHandles =
    tool === 'select'
    && !hasEdgeSelection
    && (mode === 'node-transform' || chromeVisible)

  return {
    showSelectionBox: mode === 'selection-box',
    canCanvasSelect: mode === 'idle',
    canOpenContextMenu:
      mode === 'idle'
      || mode === 'toolbar-menu'
      || mode === 'context-menu',
    canOpenToolbarMenu:
      mode === 'idle'
      || mode === 'toolbar-menu',
    nodeHandleNodeIds: showNodeHandles ? nodeIds : EMPTY_NODE_IDS,
    showNodeConnectHandles: tool === 'edge' && chromeVisible,
    showNodeToolbar:
      tool === 'select'
      && chromeVisible
      && !hasEdgeSelection
      && hasNodeSelection,
    showEdgeControls: chromeVisible && hasEdgeSelection
  }
}

export const useInteractionView = (): InteractionView => {
  const instance = useInternalInstance()
  return useView(instance.view.interaction)
}

export const readInteractionView = (
  instance: Pick<InternalWhiteboardInstance, 'state' | 'interaction'>
): InteractionView => resolveInteractionView({
  contextMenuOpen: instance.state.surface.getContextMenu().open,
  toolbarMenuOpen: instance.state.surface.getToolbarMenu().open,
  tool: instance.state.tool.get(),
  nodeIds: instance.state.selection.getNodeIds(),
  edgeId: instance.state.selection.getEdgeId(),
  session: instance.interaction.session.get()
})

export const isInteractionViewEqual = (
  left: InteractionView,
  right: InteractionView
) => (
  left.showSelectionBox === right.showSelectionBox
  && left.canCanvasSelect === right.canCanvasSelect
  && left.canOpenContextMenu === right.canOpenContextMenu
  && left.canOpenToolbarMenu === right.canOpenToolbarMenu
  && left.showNodeConnectHandles === right.showNodeConnectHandles
  && left.showNodeToolbar === right.showNodeToolbar
  && left.showEdgeControls === right.showEdgeControls
  && isSameNodeIds(left.nodeHandleNodeIds, right.nodeHandleNodeIds)
)
