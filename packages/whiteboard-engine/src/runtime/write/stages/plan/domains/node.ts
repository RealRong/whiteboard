import type { InternalInstance } from '@engine-types/instance/engine'
import type {
  WriteCommandMap
} from '@engine-types/command/api'
import type { Draft } from '../draft'
import { invalid, ops, success } from '../draft'
import type {
  Document,
  NodeId
} from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import { corePlan } from '@whiteboard/core/kernel'
import { toUpdateOperations } from '../shared/update'

type CreateCommand = Extract<NodeCommand, { type: 'create' }>
type GroupCommand = Extract<NodeCommand, { type: 'group.create' }>
type UngroupCommand = Extract<NodeCommand, { type: 'group.ungroup' }>
type UpdateManyCommand = Extract<NodeCommand, { type: 'updateMany' }>
type NodeCommand = WriteCommandMap['node']

export const node = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'config' | 'registries'>
}) => {
  const readDoc = (): Document => instance.document.get()
  const createGroupId = () => createId('group')
  const createNodeId = () => createId('node')

  const create = (command: CreateCommand): Draft => {
    const result = corePlan.node.create({
      payload: command.payload,
      doc: readDoc(),
      registries: instance.registries,
      createNodeId
    })
    return ops(result)
  }

  const group = (command: GroupCommand): Draft => {
    const result = corePlan.node.group({
      ids: command.ids,
      doc: readDoc(),
      nodeSize: instance.config.nodeSize,
      createGroupId
    })
    return ops(result)
  }

  const ungroup = (command: UngroupCommand): Draft => {
    const result = corePlan.node.ungroup({
      id: command.id,
      doc: readDoc()
    })
    return ops(result)
  }

  const updateMany = (command: UpdateManyCommand): Draft =>
    success(toUpdateOperations('node.update', command.updates))

  return (command: NodeCommand): Draft => {
    switch (command.type) {
      case 'create':
        return create(command)
      case 'updateMany':
        return updateMany(command)
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'node.delete' as const, id })))
      case 'group.create':
        return group(command)
      case 'group.ungroup':
        return ungroup(command)
      case 'order.set':
        return success([{ type: 'node.order.set', ids: command.ids }])
      default:
        return invalid('Unsupported node action.')
    }
  }
}
