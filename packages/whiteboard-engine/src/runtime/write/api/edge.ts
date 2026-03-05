import type {
  EdgeBatchUpdate,
  WriteCommandMap
} from '@engine-types/command/api'
import type { CommandSource } from '@engine-types/command/source'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { EdgeCommandsApi } from '@engine-types/write/commands'
import type {
  EdgeId,
  EdgeInput,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import type { Apply } from '../stages/plan/draft'
import { createOrderCommands } from './shared/order'

type EdgeCommand = WriteCommandMap['edge']

export const edge = ({
  instance,
  apply
}: {
  instance: Pick<InternalInstance, 'state' | 'document'>
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
    if (!updates.length) return
    void run({
      type: 'updateMany',
      updates
    })
  }

  const remove = (ids: EdgeId[]) =>
    run({ type: 'delete', ids })

  const select = (id?: EdgeId) => {
    instance.state.batch(() => {
      instance.state.write('selection', (prev) => {
        if (prev.selectedEdgeId === id) return prev
        return {
          ...prev,
          selectedEdgeId: id
        }
      })
    })
  }

  const insertAtPoint = (edgeId: EdgeId, pointWorld: Point) => {
    void run({
      type: 'routing.insertAtPoint',
      edgeId,
      pointWorld
    })
  }

  const move = (edgeId: EdgeId, index: number, pointWorld: Point) => {
    void run({
      type: 'routing.move',
      edgeId,
      index,
      pointWorld
    })
  }

  const removeAt = (edgeId: EdgeId, index: number) => {
    void run({
      type: 'routing.remove',
      edgeId,
      index
    })
  }

  const reset = (edgeId: EdgeId) => {
    void run({
      type: 'routing.reset',
      edgeId
    })
  }

  const setOrder = (ids: EdgeId[]) =>
    run({ type: 'order.set', ids })

  const order = createOrderCommands({
    set: setOrder,
    readCurrent: () => instance.document.get().order.edges
  })

  return {
    create,
    update,
    updateMany,
    delete: remove,
    select,
    routing: {
      insertAtPoint,
      move,
      remove: removeAt,
      reset
    },
    order
  }
}
