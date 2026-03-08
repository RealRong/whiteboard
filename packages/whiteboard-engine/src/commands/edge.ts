import type {
  EdgeBatchUpdate,
  WriteCommandMap
} from '@engine-types/command/api'
import type { CommandSource } from '@engine-types/command/source'
import type { EdgeCommandsApi } from '@engine-types/write/commands'
import type {
  Document,
  EdgeId,
  EdgeInput,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import type { Apply } from '../runtime/write/stages/plan/draft'
import { createOrderCommands } from './shared/order'
import { cancelledResult } from './shared/result'

type EdgeCommand = WriteCommandMap['edge']

type EdgeDocument = {
  get: () => Document
}

export const edge = ({
  document,
  apply
}: {
  document: EdgeDocument
  apply: Apply
}): EdgeCommandsApi => {
  const run = (command: EdgeCommand, source: CommandSource = 'ui') =>
    apply({
      domain: 'edge',
      command,
      source
    })

  const create = (payload: EdgeInput) =>
    run({ type: 'create', payload })

  const update = (id: EdgeId, patch: EdgePatch) =>
    run({
      type: 'updateMany',
      updates: [{ id, patch }]
    })

  const updateMany = (updates: readonly EdgeBatchUpdate[]) => {
    if (!updates.length) {
      return cancelledResult('No edge updates provided.')
    }
    return run({
      type: 'updateMany',
      updates
    })
  }

  const remove = (ids: EdgeId[]) =>
    run({ type: 'delete', ids })

  const insertAtPoint = (edgeId: EdgeId, pointWorld: Point) =>
    run({
      type: 'routing.insertAtPoint',
      edgeId,
      pointWorld
    })

  const move = (edgeId: EdgeId, index: number, pointWorld: Point) =>
    run({
      type: 'routing.move',
      edgeId,
      index,
      pointWorld
    })

  const removeAt = (edgeId: EdgeId, index: number) =>
    run({
      type: 'routing.remove',
      edgeId,
      index
    })

  const reset = (edgeId: EdgeId) =>
    run({
      type: 'routing.reset',
      edgeId
    })

  const setOrder = (ids: EdgeId[]) =>
    run({ type: 'order.set', ids })

  const order = createOrderCommands({
    set: setOrder,
    readCurrent: () => document.get().edges.order
  })

  return {
    create,
    update,
    updateMany,
    delete: remove,
    routing: {
      insertAtPoint,
      move,
      remove: removeAt,
      reset
    },
    order
  }
}
