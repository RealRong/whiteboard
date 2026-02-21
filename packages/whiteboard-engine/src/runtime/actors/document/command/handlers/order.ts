import type { Command } from '@engine-types/command'
import { operationsPlan, invalidPlan, type ReduceContext } from './helpers'

type OrderCommand = Extract<
  Command,
  | { type: 'node.order.set' }
  | { type: 'node.order.bringToFront' }
  | { type: 'node.order.sendToBack' }
  | { type: 'node.order.bringForward' }
  | { type: 'node.order.sendBackward' }
  | { type: 'edge.order.set' }
  | { type: 'edge.order.bringToFront' }
  | { type: 'edge.order.sendToBack' }
  | { type: 'edge.order.bringForward' }
  | { type: 'edge.order.sendBackward' }
>

export const planOrderCommand = (
  context: ReduceContext,
  command: OrderCommand
) => {
  switch (command.type) {
    case 'node.order.set': {
      const ids = [...command.ids]
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const allNodeIds = new Set(context.core.query.node.list().map((node) => node.id))
      if (ids.length !== allNodeIds.size) {
        return invalidPlan('Node order length mismatch.')
      }
      const uniqueIds = new Set(ids)
      if (uniqueIds.size !== ids.length) {
        return invalidPlan('Duplicate node ids in order.')
      }
      const missing = ids.find((id) => !allNodeIds.has(id))
      if (missing) {
        return invalidPlan(`Node ${missing} not found.`)
      }
      const missingInOrder = Array.from(allNodeIds).find((id) => !uniqueIds.has(id))
      if (missingInOrder) {
        return invalidPlan(`Node ${missingInOrder} missing from order.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.order.set',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'node.order.bringToFront': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalidPlan(`Node ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.order.bringToFront',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'node.order.sendToBack': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalidPlan(`Node ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.order.sendToBack',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'node.order.bringForward': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalidPlan(`Node ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.order.bringForward',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'node.order.sendBackward': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalidPlan(`Node ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'node.order.sendBackward',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'edge.order.set': {
      const ids = [...command.ids]
      if (ids.length === 0) {
        return invalidPlan('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const allEdgeIds = new Set(context.core.query.edge.list().map((edge) => edge.id))
      if (ids.length !== allEdgeIds.size) {
        return invalidPlan('Edge order length mismatch.')
      }
      const uniqueIds = new Set(ids)
      if (uniqueIds.size !== ids.length) {
        return invalidPlan('Duplicate edge ids in order.')
      }
      const missing = ids.find((id) => !allEdgeIds.has(id))
      if (missing) {
        return invalidPlan(`Edge ${missing} not found.`)
      }
      const missingInOrder = Array.from(allEdgeIds).find((id) => !uniqueIds.has(id))
      if (missingInOrder) {
        return invalidPlan(`Edge ${missingInOrder} missing from order.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.order.set',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'edge.order.bringToFront': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalidPlan(`Edge ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.order.bringToFront',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'edge.order.sendToBack': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalidPlan(`Edge ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.order.sendToBack',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'edge.order.bringForward': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalidPlan(`Edge ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.order.bringForward',
            ids,
            before: currentOrder
          }
        ]
      )
    }
    case 'edge.order.sendBackward': {
      const ids = Array.from(new Set(command.ids))
      if (ids.length === 0) {
        return invalidPlan('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalidPlan(`Edge ${missing} not found.`)
      }
      return operationsPlan(
        [
          {
            type: 'edge.order.sendBackward',
            ids,
            before: currentOrder
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
