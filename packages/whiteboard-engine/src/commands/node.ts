import type {
  NodeBatchUpdate,
  NodeUpdateManyOptions,
  WriteCommandMap
} from '@engine-types/command'
import type { EngineCommands, WriteOrigin } from '@engine-types/command'
import type { Apply } from '@engine-types/write'
import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type {
  NodeId,
  NodeInput,
  NodePatch
} from '@whiteboard/core/types'

type NodeCommand = WriteCommandMap['node']

export const node = ({
  apply
}: {
  apply: Apply
}): EngineCommands['node'] => {
  const run = <C extends NodeCommand>(
    command: C,
    origin: WriteOrigin = 'user'
  ) =>
    apply({
      domain: 'node',
      command,
      origin
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
  ) =>
    run({
      type: 'updateMany',
      updates
    }, options?.origin ?? 'user')

  const align = (
    ids: readonly NodeId[],
    mode: NodeAlignMode
  ) =>
    run({
      type: 'align',
      ids,
      mode
    })

  const distribute = (
    ids: readonly NodeId[],
    mode: NodeDistributeMode
  ) =>
    run({
      type: 'distribute',
      ids,
      mode
    })

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
    align,
    distribute,
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
