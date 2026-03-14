import type { NodeId } from '@whiteboard/core/types'
import { activeContainerIdAtom } from '../state/container'
import { readScopeView } from './container'
import { readTransientGuides } from '../draft/guides'
import { guidesAtom } from '../draft/guides'
import type { InternalWhiteboardInstance } from '../instance/types'
import { readNodeView } from './node'
import {
  isOptionalEqual,
  isRectEqual
} from '../utils/equality'
import {
  combineUnsubscribers,
  EMPTY_UNSUBSCRIBE,
  subscribeOptionalNode
} from './shared'
import type {
  OverlayView,
  ValueView
} from './types'

export const readOverlayView = (
  instance: InternalWhiteboardInstance
): OverlayView => {
  const scope = readScopeView(instance)
  const activeScopeView = scope.activeId
    ? readNodeView(instance, scope.activeId)
    : undefined

  return {
    selectionBox: instance.draft.selection.get(),
    guides: readTransientGuides(instance),
    activeScope:
      scope.activeId && scope.activeTitle && activeScopeView
        ? {
            nodeId: scope.activeId,
            title: scope.activeTitle,
            rect: activeScopeView.rect
          }
        : undefined
  }
}

export const isOverlayViewEqual = (
  left: OverlayView,
  right: OverlayView
) => (
  isRectEqual(left.selectionBox, right.selectionBox)
  && left.guides === right.guides
  && isOptionalEqual(left.activeScope, right.activeScope, (leftScope, rightScope) => (
    leftScope.nodeId === rightScope.nodeId
    && leftScope.title === rightScope.title
    && isRectEqual(leftScope.rect, rightScope.rect)
  ))
)

export const createOverlayView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<OverlayView> => ({
  get: () => readOverlayView(getInstance()),
  subscribe: (listener) => {
    const instance = getInstance()
    const { uiStore } = instance
    let activeScopeNodeId = uiStore.get(activeContainerIdAtom)
    let unsubscribeScopeNode = EMPTY_UNSUBSCRIBE

    const subscribeScopeNode = (nodeId: NodeId | undefined) => {
      if (!nodeId) {
        return EMPTY_UNSUBSCRIBE
      }

      return combineUnsubscribers([
        subscribeOptionalNode(instance, nodeId, listener),
        instance.draft.node.subscribe(nodeId, listener)
      ])
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

    const unsubscribeStatic = combineUnsubscribers([
      uiStore.sub(activeContainerIdAtom, handleScopeChange),
      uiStore.sub(guidesAtom, listener),
      instance.draft.selection.subscribe(listener)
    ])
    return () => {
      unsubscribeScopeNode()
      unsubscribeStatic()
    }
  },
  isEqual: isOverlayViewEqual
})
