import type { Operation } from '@whiteboard/core'
import type { HintContext } from '../HintContext'
import type { HintRule } from '../types'

type NodeDeleteOperation = Extract<Operation, { type: 'node.delete' }>

export class DeleteRule implements HintRule {
  canHandle = (operation: Operation): operation is NodeDeleteOperation =>
    operation.type === 'node.delete'

  apply = (operation: Operation, context: HintContext) => {
    if (!this.canHandle(operation)) return

    context.markOrderChanged()
    if (operation.before?.type === 'group') {
      context.markSubtreeDirty(operation.id)
    } else {
      context.markNodeDirty(operation.id)
    }
    context.markAncestorGroupsDirty(operation.before?.parentId)
  }
}
