import type { Command } from '@engine-types/command'
import {
  applyEdgeDefaults,
  getMissingEdgeFields,
  type EdgeInput,
  type Operation
} from '@whiteboard/core'
import {
  createUniqueId,
  operationsPlan,
  invalidPlan,
  type ReduceContext
} from './helpers'

type EdgeCommand = Extract<
  Command,
  | { type: 'edge.create' }
  | { type: 'edge.update' }
  | { type: 'edge.delete' }
  | { type: 'edge.connect' }
  | { type: 'edge.reconnect' }
>

const planEdgeCreate = (
  context: ReduceContext,
  payload: EdgeInput
) => {
  if (!payload.source?.nodeId || !payload.target?.nodeId) {
    return invalidPlan('Missing edge endpoints.')
  }
  if (!payload.type) {
    return invalidPlan('Missing edge type.')
  }
  if (payload.id && context.core.query.edge.get(payload.id)) {
    return invalidPlan(`Edge ${payload.id} already exists.`)
  }
  if (!context.core.query.node.get(payload.source.nodeId)) {
    return invalidPlan(`Source node ${payload.source.nodeId} not found.`)
  }
  if (!context.core.query.node.get(payload.target.nodeId)) {
    return invalidPlan(`Target node ${payload.target.nodeId} not found.`)
  }
  const typeDef = context.core.registries.edgeTypes.get(payload.type)
  if (typeDef?.validate && !typeDef.validate(payload.data)) {
    return invalidPlan(`Edge ${payload.type} validation failed.`)
  }
  const missing = getMissingEdgeFields(payload, context.core.registries)
  if (missing.length > 0) {
    return invalidPlan(`Missing required fields: ${missing.join(', ')}.`)
  }
  const normalized = applyEdgeDefaults(payload, context.core.registries)
  const id = normalized.id ?? createUniqueId('edge', (nextId) => Boolean(context.core.query.edge.get(nextId)))
  return operationsPlan(
    [
      {
        type: 'edge.create',
        edge: {
          ...normalized,
          id,
          type: normalized.type ?? 'linear'
        }
      }
    ]
  )
}

export const planEdgeCommand = (
  context: ReduceContext,
  command: EdgeCommand
) => {
  switch (command.type) {
    case 'edge.create': {
      return planEdgeCreate(context, command.payload)
    }
    case 'edge.update': {
      const edge = context.core.query.edge.get(command.id)
      if (!edge) {
        return invalidPlan(`Edge ${command.id} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.update',
            id: command.id,
            patch: command.patch,
            before: edge
          }
        ]
      )
    }
    case 'edge.delete': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No edge ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const edge = context.core.query.edge.get(id)
        if (!edge) {
          return invalidPlan(`Edge ${id} not found.`)
        }
        operations.push({
          type: 'edge.delete',
          id,
          before: edge
        })
      }
      return operationsPlan(operations)
    }
    case 'edge.connect': {
      return planEdgeCreate(context, {
        source: command.source,
        target: command.target,
        type: 'linear'
      })
    }
    case 'edge.reconnect': {
      const edge = context.core.query.edge.get(command.id)
      if (!edge) {
        return invalidPlan(`Edge ${command.id} not found.`)
      }
      if (!context.core.query.node.get(command.ref.nodeId)) {
        return invalidPlan(`Node ${command.ref.nodeId} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.update',
            id: command.id,
            patch: command.end === 'source' ? { source: command.ref } : { target: command.ref },
            before: edge
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
