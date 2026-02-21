import type { Command } from '@engine-types/command'
import {
  applyNodeDefaults,
  getMissingNodeFields,
  type Operation
} from '@whiteboard/core'
import {
  createUniqueId,
  operationsPlan,
  invalidPlan,
  type ReduceContext
} from './helpers'

type NodeCommand = Extract<
  Command,
  | { type: 'node.create' }
  | { type: 'node.update' }
  | { type: 'node.delete' }
  | { type: 'node.move' }
  | { type: 'node.resize' }
  | { type: 'node.rotate' }
>

export const planNodeCommand = (
  context: ReduceContext,
  command: NodeCommand
) => {
  switch (command.type) {
    case 'node.create': {
      const payload = command.payload
      if (!payload.type) {
        return invalidPlan('Missing node type.')
      }
      if (!payload.position) {
        return invalidPlan('Missing node position.')
      }
      if (payload.id && context.core.query.node.get(payload.id)) {
        return invalidPlan(`Node ${payload.id} already exists.`)
      }
      const typeDef = context.core.registries.nodeTypes.get(payload.type)
      if (typeDef?.validate && !typeDef.validate(payload.data)) {
        return invalidPlan(`Node ${payload.type} validation failed.`)
      }
      const missing = getMissingNodeFields(payload, context.core.registries)
      if (missing.length > 0) {
        return invalidPlan(`Missing required fields: ${missing.join(', ')}.`)
      }
      const normalized = applyNodeDefaults(payload, context.core.registries)
      const nodeType = normalized.type ?? payload.type
      if (!nodeType) {
        return invalidPlan('Missing node type.')
      }
      const id = normalized.id ?? createUniqueId('node', (nextId) => Boolean(context.core.query.node.get(nextId)))
      return operationsPlan(
        [
          {
            type: 'node.create',
            node: {
              ...normalized,
              id,
              type: nodeType,
              layer: nodeType === 'group' ? (normalized.layer ?? 'background') : normalized.layer
            }
          }
        ]
      )
    }
    case 'node.update': {
      const node = context.core.query.node.get(command.id)
      if (!node) {
        return invalidPlan(`Node ${command.id} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.update',
            id: command.id,
            patch: command.patch,
            before: node
          }
        ]
      )
    }
    case 'node.delete': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const node = context.core.query.node.get(id)
        if (!node) {
          return invalidPlan(`Node ${id} not found.`)
        }
        operations.push({
          type: 'node.delete',
          id,
          before: node
        })
      }
      return operationsPlan(operations)
    }
    case 'node.move': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const node = context.core.query.node.get(id)
        if (!node) {
          return invalidPlan(`Node ${id} not found.`)
        }
        operations.push({
          type: 'node.update',
          id,
          patch: {
            position: {
              x: node.position.x + command.delta.x,
              y: node.position.y + command.delta.y
            }
          },
          before: node
        })
      }
      return operationsPlan(operations)
    }
    case 'node.resize': {
      const node = context.core.query.node.get(command.id)
      if (!node) {
        return invalidPlan(`Node ${command.id} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.update',
            id: command.id,
            patch: { size: command.size },
            before: node
          }
        ]
      )
    }
    case 'node.rotate': {
      const node = context.core.query.node.get(command.id)
      if (!node) {
        return invalidPlan(`Node ${command.id} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.update',
            id: command.id,
            patch: { rotation: command.angle },
            before: node
          }
        ]
      )
    }
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown command type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}
