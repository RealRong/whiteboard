import type {
  EdgeBatchUpdate,
  WriteCommandMap
} from '@engine-types/command'
import type { CommandSource, EngineCommands } from '@engine-types/command'
import type { Apply } from '@engine-types/write'
import type {
  EdgeId,
  EdgeInput,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import { cancelled as cancelledResult } from '../result'

type EdgeCommand = WriteCommandMap['edge']

export const edge = ({
  apply
}: {
  apply: Apply
}): EngineCommands['edge'] => {
  const run = <C extends EdgeCommand>(
    command: C,
    source: CommandSource = 'user'
  ) =>
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
      type: 'routing',
      mode: 'insert',
      edgeId,
      pointWorld
    })

  const move = (edgeId: EdgeId, index: number, pointWorld: Point) =>
    run({
      type: 'routing',
      mode: 'move',
      edgeId,
      index,
      pointWorld
    })

  const removeAt = (edgeId: EdgeId, index: number) =>
    run({
      type: 'routing',
      mode: 'remove',
      edgeId,
      index
    })

  const reset = (edgeId: EdgeId) =>
    run({
      type: 'routing',
      mode: 'reset',
      edgeId
    })

  const order = {
    set: (ids: EdgeId[]) => run({ type: 'order', mode: 'set', ids }),
    bringToFront: (ids: EdgeId[]) => run({ type: 'order', mode: 'front', ids }),
    sendToBack: (ids: EdgeId[]) => run({ type: 'order', mode: 'back', ids }),
    bringForward: (ids: EdgeId[]) => run({ type: 'order', mode: 'forward', ids }),
    sendBackward: (ids: EdgeId[]) => run({ type: 'order', mode: 'backward', ids })
  }

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
