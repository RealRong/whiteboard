import type { Operation } from '@whiteboard/core'
import type { HintContext } from '../HintContext'
import type { HintRule } from '../types'

type NodeCreateOperation = Extract<Operation, { type: 'node.create' }>

export class CreateRule implements HintRule {
  canHandle = (operation: Operation): operation is NodeCreateOperation =>
    operation.type === 'node.create'

  apply = (operation: Operation, context: HintContext) => {
    if (!this.canHandle(operation)) return

    context.markOrderChanged()
    context.markNodeDirty(operation.node.id)
    context.markAncestorGroupsDirty(operation.node.parentId)
  }
}
