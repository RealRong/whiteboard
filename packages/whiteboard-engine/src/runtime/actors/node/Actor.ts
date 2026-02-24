import type { Guide } from '@engine-types/node/snap'
import type { NodeViewUpdate } from '@engine-types/projection'
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
import type { Size } from '@engine-types/common'
import { isPointEqual, isSizeEqual } from '@whiteboard/core/geometry'
import { createMutationCommit } from '../shared/MutationCommit'
import type { RunMutations, SubmitMutations } from '../shared/MutationCommit'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'projection' | 'query' | 'mutate' | 'document' | 'config' | 'registries'>
}

export class Actor {
  readonly name = 'Node'

  private readonly state: ActorOptions['instance']['state']
  private readonly projection: ActorOptions['instance']['projection']
  private readonly readDoc: () => Document
  private readonly instance: ActorOptions['instance']
  private readonly runMutations: RunMutations
  private readonly submitMutations: SubmitMutations

  constructor({ instance }: ActorOptions) {
    this.instance = instance
    this.state = instance.state
    this.projection = instance.projection
    this.readDoc = () => this.instance.document.get()
    const commit = createMutationCommit(instance.mutate)
    this.runMutations = commit.run
    this.submitMutations = commit.submit
  }

  private createGroupId = () => {
    const exists = (id: string) => Boolean(this.readDoc().nodes.some((node) => node.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `group_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `group_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  private createNodeId = () => {
    const exists = (id: string) => Boolean(this.readDoc().nodes.some((node) => node.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `node_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `node_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  private createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })

  private buildNodeCreateOperation = (payload: NodeInput) => {
    if (!payload.type) {
      return {
        ok: false as const,
        error: this.createInvalidResult('Missing node type.')
      }
    }
    if (!payload.position) {
      return {
        ok: false as const,
        error: this.createInvalidResult('Missing node position.')
      }
    }
    if (payload.id && this.readDoc().nodes.some((node) => node.id === payload.id)) {
      return {
        ok: false as const,
        error: this.createInvalidResult(`Node ${payload.id} already exists.`)
      }
    }
    const registries = this.instance.registries
    const typeDef = registries.nodeTypes.get(payload.type)
    if (typeDef?.validate && !typeDef.validate(payload.data)) {
      return {
        ok: false as const,
        error: this.createInvalidResult(`Node ${payload.type} validation failed.`)
      }
    }
    const missing = getMissingNodeFields(payload, registries)
    if (missing.length > 0) {
      return {
        ok: false as const,
        error: this.createInvalidResult(`Missing required fields: ${missing.join(', ')}.`)
      }
    }
    const normalized = applyNodeDefaults(payload, registries)
    const id = normalized.id ?? this.createNodeId()
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

  create = (payload: NodeInput) => {
    const built = this.buildNodeCreateOperation(payload)
    if (!built.ok) {
      return Promise.resolve(built.error)
    }
    return this.runMutations([built.operation])
  }

  update = (id: NodeId, patch: NodePatch) =>
    this.runMutations([{ type: 'node.update', id, patch }])

  updateData = (id: NodeId, patch: Record<string, unknown>) => {
    const node = this.instance.projection.get().nodes.canvas.find((item) => item.id === id)
    if (!node) return undefined
    return this.runMutations([
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

  updateManyPosition = (updates: Array<{ id: NodeId; position: Point }>) => {
    if (!updates.length) return
    this.submitMutations(
      updates.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: { position: item.position }
      })),
      'interaction'
    )
  }

  delete = (ids: NodeId[]) =>
    this.runMutations(ids.map((id) => ({ type: 'node.delete' as const, id })))

  createGroup = async (ids: NodeId[]) => {
    const uniqueIds = Array.from(new Set(ids))
    if (!uniqueIds.length) {
      return {
        ok: false,
        reason: 'invalid',
        message: 'No node ids provided.'
      } as const
    }

    const doc = this.readDoc()
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

    const nodeSize = this.instance.config.nodeSize
    const minX = Math.min(...nodes.map((node) => node.position.x))
    const minY = Math.min(...nodes.map((node) => node.position.y))
    const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? nodeSize.width)))
    const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? nodeSize.height)))
    const groupId = this.createGroupId()

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

    return this.runMutations(operations)
  }

  ungroup = async (id: NodeId) => {
    const doc = this.readDoc()
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

    return this.runMutations(operations)
  }

  setOrder = (ids: NodeId[]) =>
    this.runMutations([{ type: 'node.order.set', ids }])

  bringToFront = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.readDoc().order.nodes
    return this.setOrder(bringOrderToFront(current, target))
  }

  sendToBack = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.readDoc().order.nodes
    return this.setOrder(sendOrderToBack(current, target))
  }

  bringForward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.readDoc().order.nodes
    return this.setOrder(bringOrderForward(current, target))
  }

  sendBackward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.readDoc().order.nodes
    return this.setOrder(sendOrderBackward(current, target))
  }

  setDragGuides = (guides: Guide[]) => {
    this.state.write('dragGuides', guides)
  }

  clearDragGuides = () => {
    this.state.write('dragGuides', [])
  }

  setOverrides = (updates: NodeViewUpdate[]) => {
    this.projection.patchNodeOverrides(updates)
  }

  clearOverrides = (ids?: NodeId[]) => {
    this.projection.clearNodeOverrides(ids)
  }

  commitOverrides = (updates?: NodeViewUpdate[]) => {
    const list: NodeViewUpdate[] = updates ?? this.projection.readNodeOverrides()
    if (!list.length) return

    const currentDoc = this.readDoc()
    const ops = list
      .map((item) => {
        const patch: { position?: Point; size?: Size } = {}
        if (item.position) patch.position = item.position
        if (item.size) patch.size = item.size
        if (!patch.position && !patch.size) return null

        const currentNode = currentDoc?.nodes.find((node) => node.id === item.id)
        if (currentNode) {
          const samePosition = patch.position === undefined || isPointEqual(patch.position, currentNode.position)
          const sameSize = patch.size === undefined || isSizeEqual(patch.size, currentNode.size)
          if (samePosition && sameSize) return null
        }

        return {
          id: item.id,
          patch
        }
      })
      .filter((item): item is { id: NodeId; patch: { position?: Point; size?: Size } } => Boolean(item))

    if (!ops.length) {
      if (updates) {
        this.clearOverrides(updates.map((item) => item.id))
      } else {
        this.clearOverrides()
      }
      return
    }

    this.submitMutations(
      ops.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: item.patch
      })),
      'interaction'
    )
    if (updates) {
      this.clearOverrides(updates.map((item) => item.id))
    } else {
      this.clearOverrides()
    }
  }

  resetTransientState = () => {
    this.clearDragGuides()
    this.state.write('selection', (prev) => {
      if (prev.groupHovered === undefined) return prev
      return {
        ...prev,
        groupHovered: undefined
      }
    })
    this.clearOverrides()
    this.state.write('nodeDrag', {})
    this.state.write('nodeTransform', {})
    this.state.write('interactionSession', (prev) => {
      if (
        prev.active?.kind !== 'nodeDrag'
        && prev.active?.kind !== 'nodeTransform'
      ) {
        return prev
      }
      return {}
    })
  }

  cancelInteractions = () => {
    // Node input interactions are handled by dedicated pipelines.
  }
}
