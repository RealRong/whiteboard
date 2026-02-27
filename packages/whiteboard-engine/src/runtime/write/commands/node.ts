import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  Document,
  NodeId,
  NodeInput,
  NodePatch,
  Point
} from '@whiteboard/core/types'
import {
  buildNodeCreateOperation as buildNodeCreateOperationCore,
  buildNodeGroupOperations,
  buildNodeUngroupOperations,
  createInvalidDispatchResult
} from '@whiteboard/core/node'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'

type NodeCommandsInstance = Pick<
  InternalInstance,
  'mutate' | 'document' | 'config' | 'registries'
>

type Options = {
  instance: NodeCommandsInstance
}

const createInvalidResult = (message: string): DispatchResult =>
  createInvalidDispatchResult(message)

export const createNodeCommands = ({ instance }: Options) => {
  const readDoc = (): Document => instance.document.get()

  const createGroupId = () => {
    const exists = (id: string) => Boolean(readDoc().nodes.some((node) => node.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `group_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `group_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  const createNodeId = () => {
    const exists = (id: string) => Boolean(readDoc().nodes.some((node) => node.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `node_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `node_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  const buildCreateOperation = (payload: NodeInput) => {
    const result = buildNodeCreateOperationCore({
      payload,
      doc: readDoc(),
      registries: instance.registries,
      createNodeId
    })
    if (!result.ok) {
      return {
        ok: false as const,
        error: createInvalidResult(result.message)
      }
    }
    return {
      ok: true as const,
      operation: result.operation
    }
  }

  const create = (payload: NodeInput) => {
    const built = buildCreateOperation(payload)
    if (!built.ok) {
      return Promise.resolve(built.error)
    }
    return instance.mutate([built.operation], 'ui')
  }

  const update = (id: NodeId, patch: NodePatch) =>
    instance.mutate([{ type: 'node.update', id, patch }], 'ui')

  const updateData = (id: NodeId, patch: Record<string, unknown>) => {
    const node = readDoc().nodes.find((item) => item.id === id)
    if (!node) return undefined
    return instance.mutate([
      {
        type: 'node.update',
        id,
        patch: {
          data: {
            ...(node.data ?? {}),
            ...patch
          }
        }
      }
    ], 'ui')
  }

  const updateManyPosition = (updates: Array<{ id: NodeId; position: Point }>) => {
    if (!updates.length) return
    void instance.mutate(
      updates.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: { position: item.position }
      })),
      'interaction'
    )
  }

  const remove = (ids: NodeId[]) =>
    instance.mutate(ids.map((id) => ({ type: 'node.delete' as const, id })), 'ui')

  const createGroup = async (ids: NodeId[]) => {
    const result = buildNodeGroupOperations({
      ids,
      doc: readDoc(),
      nodeSize: instance.config.nodeSize,
      createGroupId
    })
    if (!result.ok) {
      return {
        ok: false,
        reason: 'invalid',
        message: result.message
      } as const
    }

    return instance.mutate(result.operations, 'ui')
  }

  const ungroup = async (id: NodeId) => {
    const result = buildNodeUngroupOperations(id, readDoc())
    if (!result.ok) {
      return {
        ok: false,
        reason: 'invalid',
        message: result.message
      } as const
    }
    return instance.mutate(result.operations, 'ui')
  }

  const setOrder = (ids: NodeId[]) =>
    instance.mutate([{ type: 'node.order.set', ids }], 'ui')

  const bringToFront = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(bringOrderToFront(current, target))
  }

  const sendToBack = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(sendOrderToBack(current, target))
  }

  const bringForward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(bringOrderForward(current, target))
  }

  const sendBackward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(sendOrderBackward(current, target))
  }

  return {
    create,
    update,
    updateData,
    updateManyPosition,
    delete: remove,
    createGroup,
    ungroup,
    setOrder,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward
  }
}

export type NodeCommandsApi = ReturnType<typeof createNodeCommands>
