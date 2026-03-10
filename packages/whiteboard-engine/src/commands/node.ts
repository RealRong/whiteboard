import type {
  NodeBatchUpdate,
  NodeUpdateManyOptions,
  WriteCommandMap
} from '@engine-types/command'
import type { CommandSource, Commands } from '@engine-types/command'
import type { Apply } from '@engine-types/write'
import type {
  NodeId,
  NodeInput,
  NodePatch
} from '@whiteboard/core/types'
import { cancelled as cancelledResult } from '../result'

type NodeCommand = WriteCommandMap['node']

export const node = ({
  apply
}: {
  apply: Apply
}): Commands['node'] => {
  const run = (command: NodeCommand, source: CommandSource = 'user') =>
    apply({
      domain: 'node',
      command,
      source
    })

  const create = (payload: NodeInput) =>
    run({ type: 'create', payload })

  const update = (id: NodeId, patch: NodePatch) =>
    run({
      type: 'updateMany',
      updates: [{ id, patch }]
    })

  const updateMany = (
    updates: readonly NodeBatchUpdate[],
    options?: NodeUpdateManyOptions
  ) => {
    if (!updates.length) {
      return Promise.resolve(cancelledResult('No node updates provided.'))
    }
    return run({
      type: 'updateMany',
      updates
    }, options?.source ?? 'user')
  }

  const updateData = (id: NodeId, patch: Record<string, unknown>) =>
    run({
      type: 'data',
      mode: 'merge',
      id,
      patch
    })

  const remove = (ids: NodeId[]) =>
    run({ type: 'delete', ids })

  const deleteCascade = (ids: NodeId[]) =>
    run({ type: 'deleteCascade', ids })

  const duplicate = (ids: NodeId[]) =>
    run({ type: 'duplicate', ids })

  const createGroup = (ids: NodeId[]) =>
    run({ type: 'group.create', ids })

  const ungroup = (id: NodeId) =>
    run({ type: 'group.ungroup', id })

  const ungroupMany = (ids: NodeId[]) =>
    run({ type: 'group.ungroupMany', ids })

  const order = {
    set: (ids: NodeId[]) => run({ type: 'order', mode: 'set', ids }),
    bringToFront: (ids: NodeId[]) => run({ type: 'order', mode: 'front', ids }),
    sendToBack: (ids: NodeId[]) => run({ type: 'order', mode: 'back', ids }),
    bringForward: (ids: NodeId[]) => run({ type: 'order', mode: 'forward', ids }),
    sendBackward: (ids: NodeId[]) => run({ type: 'order', mode: 'backward', ids })
  }

  return {
    create,
    update,
    updateMany,
    updateData,
    delete: remove,
    deleteCascade,
    duplicate,
    group: {
      create: createGroup,
      ungroup,
      ungroupMany
    },
    order
  }
}
