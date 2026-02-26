import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  Document,
  Node,
  NodeId,
  NodeInput,
  NodePatch,
  Operation,
  Point
} from '@whiteboard/core/types'
import { applyNodeDefaults, getMissingNodeFields } from '@whiteboard/core/schema'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'
import { createMutationCommit } from '../../../runtime/actors/shared/MutationCommit'

type NodeCommandsInstance = Pick<
  InternalInstance,
  'projection' | 'mutate' | 'document' | 'config' | 'registries'
>

type Options = {
  instance: NodeCommandsInstance
}

const createInvalidResult = (message: string): DispatchResult => ({
  ok: false,
  reason: 'invalid',
  message
})

export const createNodeCommands = ({ instance }: Options) => {
  const readDoc = (): Document => instance.document.get()
  const commit = createMutationCommit(instance.mutate)
  const runMutations = commit.run
  const submitMutations = commit.submit

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

  const buildNodeCreateOperation = (payload: NodeInput) => {
    if (!payload.type) {
      return {
        ok: false as const,
        error: createInvalidResult('Missing node type.')
      }
    }
    if (!payload.position) {
      return {
        ok: false as const,
        error: createInvalidResult('Missing node position.')
      }
    }
    if (payload.id && readDoc().nodes.some((node) => node.id === payload.id)) {
      return {
        ok: false as const,
        error: createInvalidResult(`Node ${payload.id} already exists.`)
      }
    }

    const registries = instance.registries
    const typeDef = registries.nodeTypes.get(payload.type)
    if (typeDef?.validate && !typeDef.validate(payload.data)) {
      return {
        ok: false as const,
        error: createInvalidResult(`Node ${payload.type} validation failed.`)
      }
    }

    const missing = getMissingNodeFields(payload, registries)
    if (missing.length > 0) {
      return {
        ok: false as const,
        error: createInvalidResult(`Missing required fields: ${missing.join(', ')}.`)
      }
    }

    const normalized = applyNodeDefaults(payload, registries)
    const id = normalized.id ?? createNodeId()
    const node: Node = {
      ...normalized,
      id,
      layer: normalized.type === 'group' ? (normalized.layer ?? 'background') : normalized.layer
    }

    return {
      ok: true as const,
      operation: {
        type: 'node.create' as const,
        node
      }
    }
  }

  const create = (payload: NodeInput) => {
    const built = buildNodeCreateOperation(payload)
    if (!built.ok) {
      return Promise.resolve(built.error)
    }
    return runMutations([built.operation])
  }

  const update = (id: NodeId, patch: NodePatch) =>
    runMutations([{ type: 'node.update', id, patch }])

  const updateData = (id: NodeId, patch: Record<string, unknown>) => {
    const node = instance.projection.getSnapshot().nodes.canvas.find((item) => item.id === id)
    if (!node) return undefined
    return runMutations([
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
    ])
  }

  const updateManyPosition = (updates: Array<{ id: NodeId; position: Point }>) => {
    if (!updates.length) return
    submitMutations(
      updates.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: { position: item.position }
      })),
      'interaction'
    )
  }

  const remove = (ids: NodeId[]) =>
    runMutations(ids.map((id) => ({ type: 'node.delete' as const, id })))

  const createGroup = async (ids: NodeId[]) => {
    const uniqueIds = Array.from(new Set(ids))
    if (!uniqueIds.length) {
      return {
        ok: false,
        reason: 'invalid',
        message: 'No node ids provided.'
      } as const
    }

    const doc = readDoc()
    const nodes: Node[] = []
    for (const id of uniqueIds) {
      const node = doc.nodes.find((item) => item.id === id)
      if (!node) {
        return {
          ok: false,
          reason: 'invalid',
          message: `Node ${id} not found.`
        } as const
      }
      nodes.push(node)
    }

    const nodeSize = instance.config.nodeSize
    const minX = Math.min(...nodes.map((node) => node.position.x))
    const minY = Math.min(...nodes.map((node) => node.position.y))
    const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? nodeSize.width)))
    const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? nodeSize.height)))
    const groupId = createGroupId()

    const operations: Operation[] = [
      {
        type: 'node.create',
        node: {
          id: groupId,
          type: 'group',
          layer: 'background',
          position: { x: minX, y: minY },
          size: {
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY)
          }
        }
      },
      ...nodes.map((node) => ({
        type: 'node.update' as const,
        id: node.id,
        patch: { parentId: groupId },
        before: node
      }))
    ]

    return runMutations(operations)
  }

  const ungroup = async (id: NodeId) => {
    const doc = readDoc()
    const groupNode = doc.nodes.find((node) => node.id === id)
    if (!groupNode) {
      return {
        ok: false,
        reason: 'invalid',
        message: `Node ${id} not found.`
      } as const
    }

    const childOperations = doc.nodes
      .filter((node) => node.parentId === id)
      .map((node) => ({
        type: 'node.update' as const,
        id: node.id,
        patch: { parentId: undefined },
        before: node
      }))

    const operations: Operation[] = [
      ...childOperations,
      {
        type: 'node.delete',
        id,
        before: groupNode
      }
    ]

    return runMutations(operations)
  }

  const setOrder = (ids: NodeId[]) =>
    runMutations([{ type: 'node.order.set', ids }])

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
