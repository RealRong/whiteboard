import type { NodePatch, Operation } from '@whiteboard/core'
import type { HintContext } from '../HintContext'
import type { HintRule } from '../types'

type NodeUpdateOperation = Extract<Operation, { type: 'node.update' }>

const hasTypePatch = (patch: NodePatch) => 'type' in patch

const hasParentPatch = (patch: NodePatch) => 'parentId' in patch

const hasLayerPatch = (patch: NodePatch) => 'layer' in patch

const toNodeType = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const isGroupCollapsed = (data: unknown) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      (data as Record<string, unknown>).collapsed === true
  )

const hasCollapsedField = (data: unknown) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      'collapsed' in (data as Record<string, unknown>)
  )

const hasGroupCollapsedPatch = (operation: NodeUpdateOperation) => {
  if (!('data' in operation.patch)) return false

  if (operation.before?.type === 'group') {
    const previousCollapsed = isGroupCollapsed(operation.before.data)
    const nextCollapsed = isGroupCollapsed(operation.patch.data)
    return previousCollapsed !== nextCollapsed
  }

  if (!operation.before) {
    return hasCollapsedField(operation.patch.data)
  }

  return false
}

export class UpdateRule implements HintRule {
  canHandle = (operation: Operation): operation is NodeUpdateOperation =>
    operation.type === 'node.update'

  apply = (operation: Operation, context: HintContext) => {
    if (!this.canHandle(operation)) return

    const nextNode = context.readNodeById().get(operation.id)
    if (hasTypePatch(operation.patch)) {
      const previousType = operation.before?.type
      const nextType =
        toNodeType(nextNode?.type) ?? toNodeType(operation.patch.type)
      if (!previousType || !nextType) {
        context.requestFullSync()
        return
      }
      if (previousType === nextType) {
        context.markNodeDirty(operation.id)
        return
      }

      const touchesGroup = previousType === 'group' || nextType === 'group'
      const touchesMindmap =
        previousType === 'mindmap' || nextType === 'mindmap'

      if (touchesGroup) {
        context.markSubtreeDirty(operation.id)
        context.markOrderChanged()
        return
      }

      context.markNodeDirty(operation.id)
      if (touchesMindmap) {
        context.markOrderChanged()
      }
      return
    }

    if (hasParentPatch(operation.patch)) {
      context.markSubtreeDirty(operation.id)
      context.markOrderChanged()
      return
    }

    if (hasGroupCollapsedPatch(operation)) {
      if (operation.before?.type === 'group' || nextNode?.type === 'group') {
        context.markSubtreeDirty(operation.id)
        context.markOrderChanged()
        return
      }
      context.markNodeDirty(operation.id)
      return
    }

    if (hasLayerPatch(operation.patch)) {
      context.markOrderChanged()
    }
    context.markNodeDirty(operation.id)
  }
}
