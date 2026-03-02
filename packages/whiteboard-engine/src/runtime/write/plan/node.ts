import type { InternalInstance } from '@engine-types/instance/engine'
import type { NodeCommand } from '../model'
import type { Draft } from '../model'
import { invalid, ops, success } from '../model'
import type { Document } from '@whiteboard/core/types'
import { corePlan } from '@whiteboard/core/kernel'
import { createScopedId } from '../id'

type CreateCommand = Extract<NodeCommand, { type: 'create' }>
type GroupCommand = Extract<NodeCommand, { type: 'group' }>
type UngroupCommand = Extract<NodeCommand, { type: 'ungroup' }>

export const node = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'config' | 'registries'>
}) => {
  const readDoc = (): Document => instance.document.get()

  const hasNodeId = (id: string) => readDoc().nodes.some((node) => node.id === id)
  const createGroupId = () => createScopedId({ prefix: 'group', exists: hasNodeId })
  const createNodeId = () => createScopedId({ prefix: 'node', exists: hasNodeId })

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

  return (command: NodeCommand): Draft => {
    switch (command.type) {
      case 'create':
        return create(command)
      case 'update':
        return success([{ type: 'node.update', id: command.id, patch: command.patch }])
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'node.delete' as const, id })))
      case 'group':
        return group(command)
      case 'ungroup':
        return ungroup(command)
      case 'order.set':
        return success([{ type: 'node.order.set', ids: command.ids }])
      case 'updateManyPosition':
        return success(
          command.updates.map((item) => ({
            type: 'node.update' as const,
            id: item.id,
            patch: { position: item.position }
          }))
        )
      default:
        return invalid('Unsupported node action.')
    }
  }
}
