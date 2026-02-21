import type { Command, CommandBatchInput } from '@engine-types/command'

export type ValidatedCommandBatchInput = {
  commands: Command[]
  meta: Omit<Exclude<CommandBatchInput, Command[]>, 'commands'> | undefined
}

const isCommandBatchObject = (
  input: CommandBatchInput
): input is Exclude<CommandBatchInput, Command[]> => !Array.isArray(input)

const validateCommand = (command: Command, index: number) => {
  switch (command.type) {
    case 'doc.reset': {
      if (!command.doc) {
        throw new Error(`Invalid command at index ${index}: doc.reset requires doc`)
      }
      return
    }
    case 'node.create':
    case 'edge.create': {
      if (!command.payload) {
        throw new Error(`Invalid command at index ${index}: ${command.type} requires payload`)
      }
      return
    }
    case 'node.update':
    case 'edge.update': {
      if (!command.id) {
        throw new Error(`Invalid command at index ${index}: ${command.type} requires id`)
      }
      if (!command.patch) {
        throw new Error(`Invalid command at index ${index}: ${command.type} requires patch`)
      }
      return
    }
    case 'node.delete':
    case 'edge.delete': {
      if (!Array.isArray(command.ids)) {
        throw new Error(`Invalid command at index ${index}: ${command.type} requires ids array`)
      }
      return
    }
    case 'node.move': {
      if (!Array.isArray(command.ids)) {
        throw new Error(`Invalid command at index ${index}: node.move requires ids array`)
      }
      if (!command.delta) {
        throw new Error(`Invalid command at index ${index}: node.move requires delta`)
      }
      return
    }
    case 'node.resize': {
      if (!command.id || !command.size) {
        throw new Error(`Invalid command at index ${index}: node.resize requires id and size`)
      }
      return
    }
    case 'node.rotate': {
      if (!command.id || typeof command.angle !== 'number') {
        throw new Error(`Invalid command at index ${index}: node.rotate requires id and angle`)
      }
      return
    }
    case 'edge.connect': {
      if (!command.source || !command.target) {
        throw new Error(`Invalid command at index ${index}: edge.connect requires source and target`)
      }
      return
    }
    case 'edge.reconnect': {
      if (!command.id || !command.ref || (command.end !== 'source' && command.end !== 'target')) {
        throw new Error(`Invalid command at index ${index}: edge.reconnect requires id, end and ref`)
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
      if (!Array.isArray(command.ids)) {
        throw new Error(`Invalid command at index ${index}: ${command.type} requires ids array`)
      }
      return
    }
    case 'group.ungroup': {
      if (!command.id) {
        throw new Error(`Invalid command at index ${index}: group.ungroup requires id`)
      }
      return
    }
    case 'viewport.set': {
      if (!command.viewport) {
        throw new Error(`Invalid command at index ${index}: viewport.set requires viewport`)
      }
      return
    }
    case 'viewport.panBy': {
      if (!command.delta) {
        throw new Error(`Invalid command at index ${index}: viewport.panBy requires delta`)
      }
      return
    }
    case 'viewport.zoomBy': {
      if (typeof command.factor !== 'number') {
        throw new Error(`Invalid command at index ${index}: viewport.zoomBy requires factor`)
      }
      return
    }
    case 'viewport.zoomTo': {
      if (typeof command.zoom !== 'number') {
        throw new Error(`Invalid command at index ${index}: viewport.zoomTo requires zoom`)
      }
      return
    }
    case 'viewport.reset':
    case 'mindmap.create': {
      return
    }
    case 'mindmap.replace': {
      if (!command.id || !command.tree) {
        throw new Error(`Invalid command at index ${index}: mindmap.replace requires id and tree`)
      }
      return
    }
    case 'mindmap.addChild': {
      if (!command.id || !command.parentId) {
        throw new Error(`Invalid command at index ${index}: mindmap.addChild requires id and parentId`)
      }
      return
    }
    case 'mindmap.addSibling': {
      if (!command.id || !command.nodeId || (command.position !== 'before' && command.position !== 'after')) {
        throw new Error(`Invalid command at index ${index}: mindmap.addSibling requires id, nodeId and position`)
      }
      return
    }
    case 'mindmap.moveSubtree': {
      if (!command.id || !command.nodeId || !command.newParentId) {
        throw new Error(`Invalid command at index ${index}: mindmap.moveSubtree requires id, nodeId and newParentId`)
      }
      return
    }
    case 'mindmap.removeSubtree':
    case 'mindmap.cloneSubtree':
    case 'mindmap.toggleCollapse': {
      if (!command.id || !command.nodeId) {
        throw new Error(`Invalid command at index ${index}: ${command.type} requires id and nodeId`)
      }
      return
    }
    case 'mindmap.setNodeData': {
      if (!command.id || !command.nodeId || !command.patch) {
        throw new Error(`Invalid command at index ${index}: mindmap.setNodeData requires id, nodeId and patch`)
      }
      return
    }
    case 'mindmap.reorderChild': {
      if (!command.id || !command.parentId) {
        throw new Error(`Invalid command at index ${index}: mindmap.reorderChild requires id and parentId`)
      }
      return
    }
    case 'mindmap.setSide': {
      if (!command.id || !command.nodeId || (command.side !== 'left' && command.side !== 'right')) {
        throw new Error(`Invalid command at index ${index}: mindmap.setSide requires id, nodeId and side`)
      }
      return
    }
    case 'mindmap.attachExternal': {
      if (!command.id || !command.targetId || !command.payload) {
        throw new Error(`Invalid command at index ${index}: mindmap.attachExternal requires id, targetId and payload`)
      }
      return
    }
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown command type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}

export const validateCommandBatchInput = (
  input: CommandBatchInput
): ValidatedCommandBatchInput => {
  const source = isCommandBatchObject(input) ? input.commands : input
  const meta = isCommandBatchObject(input)
    ? (({ id, docId, source: inputSource, actor, timestamp }) => ({
        id,
        docId,
        source: inputSource,
        actor,
        timestamp
      }))(input)
    : undefined

  if (!Array.isArray(source)) {
    throw new Error('Invalid command batch input: commands must be an array')
  }

  source.forEach((command, index) => {
    validateCommand(command, index)
  })

  return {
    commands: source,
    meta
  }
}
