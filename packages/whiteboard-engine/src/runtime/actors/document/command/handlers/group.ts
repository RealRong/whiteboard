import type { Command } from '@engine-types/command'
import type { Core, Operation } from '@whiteboard/core'
import {
  operationsPlan,
  createUniqueId,
  invalidPlan,
  type ReduceContext
} from './helpers'

type GroupCommand = Extract<
  Command,
  | { type: 'group.create' }
  | { type: 'group.ungroup' }
>

export const planGroupCommand = (
  context: ReduceContext,
  command: GroupCommand
) => {
  switch (command.type) {
    case 'group.create': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const nodes = ids
        .map((id) => context.core.query.node.get(id))
        .filter((node): node is NonNullable<ReturnType<Core['query']['node']['get']>> => Boolean(node))
      if (nodes.length !== ids.length) {
        const existing = new Set(nodes.map((node) => node.id))
        const missing = ids.find((id) => !existing.has(id))
        return invalidPlan(`Node ${missing} not found.`)
      }
      const minX = Math.min(...nodes.map((node) => node.position.x))
      const minY = Math.min(...nodes.map((node) => node.position.y))
      const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? 0)))
      const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? 0)))
      const groupId = createUniqueId('group', (id) => Boolean(context.core.query.node.get(id)))
      const operations: Operation[] = [
        {
          type: 'node.create',
          node: {
            id: groupId,
            type: 'group',
            layer: 'background',
            position: { x: minX, y: minY },
            size: {
              width: Math.max(0, maxX - minX),
              height: Math.max(0, maxY - minY)
            }
          }
        },
        ...nodes.map(
          (node) =>
            ({
              type: 'node.update',
              id: node.id,
              patch: { parentId: groupId },
              before: node
            }) satisfies Operation
        )
      ]
      return operationsPlan(operations)
    }
    case 'group.ungroup': {
      const groupNode = context.core.query.node.get(command.id)
      if (!groupNode) {
        return invalidPlan(`Node ${command.id} not found.`)
      }
      const childOperations = context.core.query.node.list()
        .filter((node) => node.parentId === command.id)
        .map(
          (node) =>
            ({
              type: 'node.update',
              id: node.id,
              patch: { parentId: undefined },
              before: node
            }) satisfies Operation
        )
      return operationsPlan(
        [
          ...childOperations,
          {
            type: 'node.delete',
            id: command.id,
            before: groupNode
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
