import type { NodeId } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../instance/types'

export type Unsubscribe = () => void

export const EMPTY_UNSUBSCRIBE: Unsubscribe = () => {}

export const combineUnsubscribers = (
  unsubscribers: readonly Unsubscribe[]
): Unsubscribe => () => {
  unsubscribers.forEach((unsubscribe) => {
    unsubscribe()
  })
}

export const subscribeNodeIds = (
  instance: Pick<InternalWhiteboardInstance, 'read'>,
  nodeIds: readonly NodeId[],
  listener: () => void
): Unsubscribe => {
  if (!nodeIds.length) {
    return EMPTY_UNSUBSCRIBE
  }

  return combineUnsubscribers(nodeIds.map((nodeId) =>
    instance.read.node.subscribe(nodeId, listener)
  ))
}

export const subscribeOptionalNode = (
  instance: Pick<InternalWhiteboardInstance, 'read'>,
  nodeId: NodeId | undefined,
  listener: () => void
): Unsubscribe => {
  if (!nodeId) {
    return EMPTY_UNSUBSCRIBE
  }

  return instance.read.node.subscribe(nodeId, listener)
}
