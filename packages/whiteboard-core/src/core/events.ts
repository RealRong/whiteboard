import type { ChangeSet, CoreEvent } from '../types/core'

export type EventBus = {
  eventHandlers: Map<CoreEvent['type'], Set<(e: CoreEvent) => void>>
  emitEvent: <T extends CoreEvent>(event: T) => void
  emitChangesApplied: (changes: ChangeSet) => void
}

export const createEventBus = (): EventBus => {
  const eventHandlers = new Map<CoreEvent['type'], Set<(e: CoreEvent) => void>>()

  const emitEvent = <T extends CoreEvent>(event: T) => {
    const handlers = eventHandlers.get(event.type)
    if (!handlers) return
    handlers.forEach((handler) => handler(event))
  }

  const emitChangesApplied = (changes: ChangeSet) => {
    emitEvent({ type: 'changes.applied', changes })
    changes.operations.forEach((op) => {
      switch (op.type) {
        case 'node.create':
          emitEvent({ type: 'node.created', node: op.node })
          break
        case 'node.update':
          emitEvent({ type: 'node.updated', id: op.id, patch: op.patch })
          break
        case 'node.delete':
          emitEvent({ type: 'node.deleted', id: op.id })
          break
        case 'edge.create':
          emitEvent({ type: 'edge.created', edge: op.edge })
          break
        case 'edge.update':
          emitEvent({ type: 'edge.updated', id: op.id, patch: op.patch })
          break
        case 'edge.delete':
          emitEvent({ type: 'edge.deleted', id: op.id })
          break
        case 'mindmap.create':
          emitEvent({ type: 'mindmap.created', mindmap: op.mindmap })
          break
        case 'mindmap.replace':
          emitEvent({ type: 'mindmap.updated', id: op.id, mindmap: op.after })
          break
        case 'mindmap.delete':
          emitEvent({ type: 'mindmap.deleted', id: op.id })
          break
        case 'mindmap.node.create':
          emitEvent({ type: 'mindmap.node.created', id: op.id, node: op.node })
          break
        case 'mindmap.node.update':
          emitEvent({ type: 'mindmap.node.updated', id: op.id, nodeId: op.nodeId, patch: op.patch })
          break
        case 'mindmap.node.delete':
          emitEvent({ type: 'mindmap.node.deleted', id: op.id, nodeId: op.nodeId })
          break
        case 'mindmap.node.move':
          emitEvent({ type: 'mindmap.node.moved', id: op.id, nodeId: op.nodeId, toParentId: op.toParentId })
          break
        case 'mindmap.node.reorder':
          emitEvent({
            type: 'mindmap.node.reordered',
            id: op.id,
            parentId: op.parentId,
            fromIndex: op.fromIndex,
            toIndex: op.toIndex
          })
          break
        case 'viewport.update':
          emitEvent({ type: 'viewport.updated', viewport: op.after })
          break
        default:
          break
      }
    })
  }

  return {
    eventHandlers,
    emitEvent,
    emitChangesApplied
  }
}
