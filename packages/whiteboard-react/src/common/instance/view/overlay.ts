import type { NodeId } from '@whiteboard/core/types'
import { activeContainerIdAtom } from '../../../container/domain'
import { contextMenuStateAtom } from '../../../context-menu/domain'
import { readInteractionView } from '../../../interaction/view'
import { interactionSessionStateAtom } from '../../../interaction/session'
import { readScopeView } from '../../../container/view'
import { isRectEqual } from '../../../selection/view'
import { selectionAtom } from '../../../selection/domain'
import { readTransientGuides } from '../../../transient/guides'
import { guidesAtom } from '../../../transient/guides'
import { nodeToolbarMenuStateAtom } from '../../../toolbar/domain'
import { toolAtom } from '../toolState'
import type { InternalWhiteboardInstance } from '../types'
import { readNodeView } from './node'
import type {
  OverlayView,
  ValueView
} from './types'

export const readOverlayView = (
  instance: InternalWhiteboardInstance
): OverlayView => {
  const interaction = readInteractionView(instance)
  const scope = readScopeView(instance)
  const activeScopeView = scope.activeId
    ? readNodeView(instance, scope.activeId)
    : undefined

  return {
    selectionBox: interaction.showSelectionBox
      ? instance.draft.selection.get()
      : undefined,
    guides: readTransientGuides(instance),
    activeScope:
      scope.activeId && scope.activeTitle && activeScopeView
        ? {
            nodeId: scope.activeId,
            title: scope.activeTitle,
            rect: activeScopeView.rect
          }
        : undefined,
    nodeHandleNodeIds: interaction.nodeHandleNodeIds,
    showNodeConnectHandles: interaction.showNodeConnectHandles,
    showEdgeControls: interaction.showEdgeControls
  }
}

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

export const isOverlayViewEqual = (
  left: OverlayView,
  right: OverlayView
) => (
  isRectEqual(left.selectionBox, right.selectionBox)
  && left.guides === right.guides
  && left.activeScope?.nodeId === right.activeScope?.nodeId
  && left.activeScope?.title === right.activeScope?.title
  && isRectEqual(left.activeScope?.rect, right.activeScope?.rect)
  && isSameNodeIds(left.nodeHandleNodeIds, right.nodeHandleNodeIds)
  && left.showNodeConnectHandles === right.showNodeConnectHandles
  && left.showEdgeControls === right.showEdgeControls
)

export const createOverlayView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<OverlayView> => ({
  get: () => readOverlayView(getInstance()),
  subscribe: (listener) => {
    const instance = getInstance()
    const { uiStore } = instance
    let activeScopeNodeId = uiStore.get(activeContainerIdAtom)
    let unsubscribeScopeNode = () => {}

    const subscribeScopeNode = (nodeId: NodeId | undefined) => {
      if (!nodeId) {
        return () => {}
      }

      const unsubscribers = [
        instance.read.node.subscribe(nodeId, listener),
        instance.draft.node.subscribe(nodeId, listener)
      ]

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    }

    unsubscribeScopeNode = subscribeScopeNode(activeScopeNodeId)

    const handleScopeChange = () => {
      const nextNodeId = uiStore.get(activeContainerIdAtom)
      if (nextNodeId !== activeScopeNodeId) {
        unsubscribeScopeNode()
        activeScopeNodeId = nextNodeId
        unsubscribeScopeNode = subscribeScopeNode(activeScopeNodeId)
      }
      listener()
    }

    const unsubscribers = [
      uiStore.sub(toolAtom, listener),
      uiStore.sub(selectionAtom, listener),
      uiStore.sub(activeContainerIdAtom, handleScopeChange),
      uiStore.sub(contextMenuStateAtom, listener),
      uiStore.sub(nodeToolbarMenuStateAtom, listener),
      uiStore.sub(interactionSessionStateAtom, listener),
      uiStore.sub(guidesAtom, listener),
      instance.draft.selection.subscribe(listener)
    ]

    return () => {
      unsubscribeScopeNode()
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  },
  isEqual: isOverlayViewEqual
})
