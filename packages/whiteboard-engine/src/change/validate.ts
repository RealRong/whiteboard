import type { Change, ChangeSetInput } from '@engine-types/change'

export type ValidatedChangeSetInput = {
  changes: Change[]
  meta: Omit<Exclude<ChangeSetInput, Change[]>, 'changes'> | undefined
}

const isChangeSetObject = (
  input: ChangeSetInput
): input is Exclude<ChangeSetInput, Change[]> => !Array.isArray(input)

const validateChange = (change: Change, index: number) => {
  switch (change.type) {
    case 'doc.reset': {
      if (!change.doc) {
        throw new Error(`Invalid change at index ${index}: doc.reset requires doc`)
      }
      return
    }
    case 'node.create':
    case 'edge.create': {
      if (!change.payload) {
        throw new Error(`Invalid change at index ${index}: ${change.type} requires payload`)
      }
      return
    }
    case 'node.update':
    case 'edge.update': {
      if (!change.id) {
        throw new Error(`Invalid change at index ${index}: ${change.type} requires id`)
      }
      if (!change.patch) {
        throw new Error(`Invalid change at index ${index}: ${change.type} requires patch`)
      }
      return
    }
    case 'node.delete':
    case 'edge.delete': {
      if (!Array.isArray(change.ids)) {
        throw new Error(`Invalid change at index ${index}: ${change.type} requires ids array`)
      }
      return
    }
    case 'node.move': {
      if (!Array.isArray(change.ids)) {
        throw new Error(`Invalid change at index ${index}: node.move requires ids array`)
      }
      if (!change.delta) {
        throw new Error(`Invalid change at index ${index}: node.move requires delta`)
      }
      return
    }
    case 'node.resize': {
      if (!change.id || !change.size) {
        throw new Error(`Invalid change at index ${index}: node.resize requires id and size`)
      }
      return
    }
    case 'node.rotate': {
      if (!change.id || typeof change.angle !== 'number') {
        throw new Error(`Invalid change at index ${index}: node.rotate requires id and angle`)
      }
      return
    }
    case 'edge.connect': {
      if (!change.source || !change.target) {
        throw new Error(`Invalid change at index ${index}: edge.connect requires source and target`)
      }
      return
    }
    case 'edge.reconnect': {
      if (!change.id || !change.ref || (change.end !== 'source' && change.end !== 'target')) {
        throw new Error(`Invalid change at index ${index}: edge.reconnect requires id, end and ref`)
      }
      return
    }
    case 'node.order.set':
    case 'node.order.bringToFront':
    case 'node.order.sendToBack':
    case 'node.order.bringForward':
    case 'node.order.sendBackward':
    case 'edge.order.set':
    case 'edge.order.bringToFront':
    case 'edge.order.sendToBack':
    case 'edge.order.bringForward':
    case 'edge.order.sendBackward':
    case 'group.create':
    case 'mindmap.delete': {
      if (!Array.isArray(change.ids)) {
        throw new Error(`Invalid change at index ${index}: ${change.type} requires ids array`)
      }
      return
    }
    case 'group.ungroup': {
      if (!change.id) {
        throw new Error(`Invalid change at index ${index}: group.ungroup requires id`)
      }
      return
    }
    case 'viewport.set': {
      if (!change.viewport) {
        throw new Error(`Invalid change at index ${index}: viewport.set requires viewport`)
      }
      return
    }
    case 'viewport.panBy': {
      if (!change.delta) {
        throw new Error(`Invalid change at index ${index}: viewport.panBy requires delta`)
      }
      return
    }
    case 'viewport.zoomBy': {
      if (typeof change.factor !== 'number') {
        throw new Error(`Invalid change at index ${index}: viewport.zoomBy requires factor`)
      }
      return
    }
    case 'viewport.zoomTo': {
      if (typeof change.zoom !== 'number') {
        throw new Error(`Invalid change at index ${index}: viewport.zoomTo requires zoom`)
      }
      return
    }
    case 'viewport.reset':
    case 'mindmap.create': {
      return
    }
    case 'mindmap.replace': {
      if (!change.id || !change.tree) {
        throw new Error(`Invalid change at index ${index}: mindmap.replace requires id and tree`)
      }
      return
    }
    case 'mindmap.addChild': {
      if (!change.id || !change.parentId) {
        throw new Error(`Invalid change at index ${index}: mindmap.addChild requires id and parentId`)
      }
      return
    }
    case 'mindmap.addSibling': {
      if (!change.id || !change.nodeId || (change.position !== 'before' && change.position !== 'after')) {
        throw new Error(`Invalid change at index ${index}: mindmap.addSibling requires id, nodeId and position`)
      }
      return
    }
    case 'mindmap.moveSubtree': {
      if (!change.id || !change.nodeId || !change.newParentId) {
        throw new Error(`Invalid change at index ${index}: mindmap.moveSubtree requires id, nodeId and newParentId`)
      }
      return
    }
    case 'mindmap.removeSubtree':
    case 'mindmap.cloneSubtree':
    case 'mindmap.toggleCollapse': {
      if (!change.id || !change.nodeId) {
        throw new Error(`Invalid change at index ${index}: ${change.type} requires id and nodeId`)
      }
      return
    }
    case 'mindmap.setNodeData': {
      if (!change.id || !change.nodeId || !change.patch) {
        throw new Error(`Invalid change at index ${index}: mindmap.setNodeData requires id, nodeId and patch`)
      }
      return
    }
    case 'mindmap.reorderChild': {
      if (!change.id || !change.parentId) {
        throw new Error(`Invalid change at index ${index}: mindmap.reorderChild requires id and parentId`)
      }
      return
    }
    case 'mindmap.setSide': {
      if (!change.id || !change.nodeId || (change.side !== 'left' && change.side !== 'right')) {
        throw new Error(`Invalid change at index ${index}: mindmap.setSide requires id, nodeId and side`)
      }
      return
    }
    case 'mindmap.attachExternal': {
      if (!change.id || !change.targetId || !change.payload) {
        throw new Error(`Invalid change at index ${index}: mindmap.attachExternal requires id, targetId and payload`)
      }
      return
    }
    default: {
      const exhaustive: never = change
      throw new Error(`Unknown change type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}

export const validateChangeSetInput = (
  input: ChangeSetInput
): ValidatedChangeSetInput => {
  const source = isChangeSetObject(input) ? input.changes : input
  const meta = isChangeSetObject(input)
    ? (({ id, docId, source: inputSource, actor, timestamp }) => ({
        id,
        docId,
        source: inputSource,
        actor,
        timestamp
      }))(input)
    : undefined

  if (!Array.isArray(source)) {
    throw new Error('Invalid change set input: changes must be an array')
  }

  source.forEach((change, index) => {
    validateChange(change, index)
  })

  return {
    changes: source,
    meta
  }
}
