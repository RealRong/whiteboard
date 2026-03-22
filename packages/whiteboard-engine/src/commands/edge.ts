import type {
  EdgeBatchUpdate,
  WriteCommandMap
} from '@engine-types/command'
import type { EngineCommands, WriteOrigin } from '@engine-types/command'
import type { Apply } from '@engine-types/write'
import type {
  EdgeId,
  EdgeInput,
  EdgePatch,
  Point
} from '@whiteboard/core/types'

type EdgeCommand = WriteCommandMap['edge']

export const edge = ({
  apply
}: {
  apply: Apply
}): EngineCommands['edge'] => {
  const run = <C extends EdgeCommand>(
    command: C,
    origin: WriteOrigin = 'user'
  ) =>
    apply({
      domain: 'edge',
      command,
      origin
    })

  const create = (payload: EdgeInput) =>
    run({ type: 'create', payload })

  const move = (edgeId: EdgeId, delta: Point) =>
    run({
      type: 'move',
      edgeId,
      delta
    })

  const update = (id: EdgeId, patch: EdgePatch) =>
    run({
      type: 'updateMany',
      updates: [{ id, patch }]
    })

  const updateMany = (updates: readonly EdgeBatchUpdate[]) =>
    run({
      type: 'updateMany',
      updates
    })

  const remove = (ids: EdgeId[]) =>
    run({ type: 'delete', ids })

  const insert = (edgeId: EdgeId, point: Point) =>
    run({
      type: 'path',
      mode: 'insert',
      edgeId,
      point
    })

  const movePath = (edgeId: EdgeId, index: number, point: Point) =>
    run({
      type: 'path',
      mode: 'move',
      edgeId,
      index,
      point
    })

  const removeAt = (edgeId: EdgeId, index: number) =>
    run({
      type: 'path',
      mode: 'remove',
      edgeId,
      index
    })

  const clear = (edgeId: EdgeId) =>
    run({
      type: 'path',
      mode: 'clear',
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
    move,
    update,
    updateMany,
    delete: remove,
    path: {
      insert,
      move: movePath,
      remove: removeAt,
      clear
    },
    order
  }
}
