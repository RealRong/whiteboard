import type { Operation } from '@whiteboard/core'
import type { HintContext } from '../HintContext'
import type { HintRule } from '../types'

type NodeOrderOperation = Extract<
  Operation,
  | { type: 'node.order.set' }
  | { type: 'node.order.bringToFront' }
  | { type: 'node.order.sendToBack' }
  | { type: 'node.order.bringForward' }
  | { type: 'node.order.sendBackward' }
>

const NODE_ORDER_OPERATION_TYPES = new Set<Operation['type']>([
  'node.order.set',
  'node.order.bringToFront',
  'node.order.sendToBack',
  'node.order.bringForward',
  'node.order.sendBackward'
])

export class OrderRule implements HintRule {
  canHandle = (operation: Operation): operation is NodeOrderOperation =>
    NODE_ORDER_OPERATION_TYPES.has(operation.type)

  apply = (operation: Operation, context: HintContext) => {
    if (!this.canHandle(operation)) return

    context.markOrderChanged()
    operation.ids.forEach((nodeId) => {
      const node = context.readNodeById().get(nodeId)
      if (!node) return
      context.markAncestorGroupsDirty(node.parentId)
    })
  }
}
