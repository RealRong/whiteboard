import type {
  NodeBatchUpdate,
  NodeUpdateManyOptions,
  WriteCommandMap
} from '@engine-types/command'
import type { CommandSource } from '@engine-types/command'
import type { NodeCommandsApi } from '@engine-types/write'
import type {
  Document,
  NodeId,
  NodeInput,
  NodePatch
} from '@whiteboard/core/types'
import { getNode } from '@whiteboard/core/types'
import type { Apply } from '../write/draft'
import { createOrderCommands } from './order'
import { cancelledResult, invalidResult } from './result'

type NodeCommand = WriteCommandMap['node']

type NodeDocument = {
  get: () => Document
}

export const node = ({
  document,
  apply
}: {
  document: NodeDocument
  apply: Apply
}): NodeCommandsApi => {
  const readDoc = (): Document => document.get()
  const run = (command: NodeCommand, source: CommandSource = 'ui') =>
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
      return cancelledResult('No node updates provided.')
    }
    return run({
      type: 'updateMany',
      updates
    }, options?.source ?? 'interaction')
  }

  const updateData = (id: NodeId, patch: Record<string, unknown>) => {
    const current = getNode(readDoc(), id)
    if (!current) {
      return invalidResult(`Node ${id} not found.`)
    }
    return update(id, {
      data: {
        ...(current.data ?? {}),
        ...patch
      }
    })
  }

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

  const setOrder = (ids: NodeId[]) =>
    run({ type: 'order.set', ids })

  const order = createOrderCommands({
    set: setOrder,
    readCurrent: () => readDoc().nodes.order
  })

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
