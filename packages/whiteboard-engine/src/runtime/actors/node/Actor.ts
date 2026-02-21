import type { Guide } from '@engine-types/node/snap'
import type { GraphChange, GraphProjector, NodeViewUpdate } from '@engine-types/graph'
import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type {
  NodeDragCancelOptions,
  NodeDragStartOptions,
  NodeResizeStartOptions,
  NodeRotateStartOptions,
  NodeTransformCancelOptions
} from '@engine-types/commands'
import type {
  DispatchResult,
  Document,
  Node,
  NodeId,
  NodeInput,
  NodePatch,
  Operation,
  Point
} from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import { isPointEqual, isSizeEqual } from '../../../runtime/common/geometry'
import { MutationExecutor } from '../shared/MutationExecutor'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '../shared/order'
import { Drag } from './Drag'
import { Transform } from './Transform'

type ActorOptions = {
  state: Pick<State, 'write'>
  graph: GraphProjector
  syncGraph: (change: GraphChange) => void
  readDoc: () => Document | null
  instance: Pick<InternalInstance, 'state' | 'graph' | 'runtime' | 'query' | 'mutate'>
}

export class Actor {
  readonly name = 'Node'

  private readonly state: Pick<State, 'write'>
  private readonly graph: GraphProjector
  private readonly syncGraph: (change: GraphChange) => void
  private readonly readDoc: () => Document | null
  private readonly instance: ActorOptions['instance']
  private readonly mutation: MutationExecutor
  private readonly drag: Drag
  private readonly transform: Transform

  constructor({
    state,
    graph,
    syncGraph,
    readDoc,
    instance
  }: ActorOptions) {
    this.state = state
    this.graph = graph
    this.syncGraph = syncGraph
    this.readDoc = readDoc
    this.instance = instance
    this.mutation = new MutationExecutor(instance)
    const transient = {
      setGuides: this.setDragGuides,
      clearGuides: this.clearDragGuides,
      setOverrides: this.setOverrides,
      commitOverrides: this.commitOverrides,
      clearOverrides: this.clearOverrides
    }
    this.drag = new Drag({
      instance,
      transient
    })
    this.transform = new Transform({
      instance,
      transient
    })
  }

  private flushGraphChange = (change: GraphChange | undefined) => {
    if (!change) return
    this.syncGraph(change)
  }

  private createGroupId = () => {
    const exists = (id: string) => Boolean(this.instance.runtime.core.query.node.get(id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `group_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `group_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  create = (payload: NodeInput) =>
    this.mutation.runCommand({ type: 'node.create', payload }, 'node.create')

  update = (id: NodeId, patch: NodePatch) =>
    this.mutation.runCommand({ type: 'node.update', id, patch }, 'node.update')

  updateData = (id: NodeId, patch: Record<string, unknown>) => {
    const node = this.instance.graph.read().canvasNodes.find((item) => item.id === id)
    if (!node) return undefined
    return this.mutation.runCommand({
      type: 'node.update',
      id,
      patch: {
        data: {
          ...(node.data ?? {}),
          ...patch
        }
      }
    }, 'node.updateData')
  }

  updateManyPosition = (updates: Array<{ id: NodeId; position: Point }>) => {
    if (!updates.length) return
    void this.mutation.runMutations(
      updates.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: { position: item.position }
      })),
      'node.updateManyPosition',
      'interaction'
    )
  }

  delete = (ids: NodeId[]) =>
    this.mutation.runCommand({ type: 'node.delete', ids }, 'node.delete')

  createGroup = async (ids: NodeId[]) => {
    const uniqueIds = Array.from(new Set(ids))
    if (!uniqueIds.length) {
      return {
        ok: false,
        reason: 'invalid',
        message: 'No node ids provided.'
      } as const
    }

    const nodes: Node[] = []
    for (const id of uniqueIds) {
      const node = this.instance.runtime.core.query.node.get(id)
      if (!node) {
        return {
          ok: false,
          reason: 'invalid',
          message: `Node ${id} not found.`
        } as const
      }
      nodes.push(node)
    }

    const nodeSize = this.instance.runtime.config.nodeSize
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

    return this.mutation.runMutations(operations, 'group.create')
  }

  ungroup = async (id: NodeId) => {
    const groupNode = this.instance.runtime.core.query.node.get(id)
    if (!groupNode) {
      return {
        ok: false,
        reason: 'invalid',
        message: `Node ${id} not found.`
      } as const
    }

    const childOperations = this.instance.runtime.core.query.node.list()
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

    return this.mutation.runMutations(operations, 'group.ungroup')
  }

  setOrder = (ids: NodeId[]) =>
    this.mutation.runCommand({ type: 'node.order.set', ids }, 'order.node.set')

  bringToFront = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.core.query.document().order.nodes
    return this.setOrder(bringOrderToFront(current, target))
  }

  sendToBack = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.core.query.document().order.nodes
    return this.setOrder(sendOrderToBack(current, target))
  }

  bringForward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.core.query.document().order.nodes
    return this.setOrder(bringOrderForward(current, target))
  }

  sendBackward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.core.query.document().order.nodes
    return this.setOrder(sendOrderBackward(current, target))
  }

  setDragGuides = (guides: Guide[]) => {
    this.state.write('dragGuides', guides)
  }

  clearDragGuides = () => {
    this.state.write('dragGuides', [])
  }

  setOverrides = (updates: NodeViewUpdate[]) => {
    this.flushGraphChange(this.graph.patchNodeOverrides(updates))
  }

  clearOverrides = (ids?: NodeId[]) => {
    this.flushGraphChange(this.graph.clearNodeOverrides(ids))
  }

  commitOverrides = (updates?: NodeViewUpdate[]) => {
    const list: NodeViewUpdate[] = updates ?? this.graph.readNodeOverrides()
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

    void this.instance.mutate(
      ops.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: item.patch
      })),
      {
        source: 'interaction',
        actor: 'node.overrides'
      }
    )
    if (updates) {
      this.clearOverrides(updates.map((item) => item.id))
    } else {
      this.clearOverrides()
    }
  }

  resetTransientState = () => {
    this.clearDragGuides()
    this.state.write('groupHovered', undefined)
    this.clearOverrides()
    this.state.write('nodeDrag', {})
    this.state.write('nodeTransform', {})
  }

  cancelDrag = (options?: NodeDragCancelOptions) =>
    this.drag.cancel(options)

  cancelTransform = (options?: NodeTransformCancelOptions) =>
    this.transform.cancel(options)

  startDrag = (options: NodeDragStartOptions) =>
    this.drag.start(options)

  startResize = (options: NodeResizeStartOptions) =>
    this.transform.startResize(options)

  startRotate = (options: NodeRotateStartOptions) =>
    this.transform.startRotate(options)

  updateDrag = (pointer: PointerInput) =>
    this.drag.update({ pointer })

  endDrag = (pointer: PointerInput) =>
    this.drag.end({ pointer })

  updateTransform = (pointer: PointerInput, minSize?: Size) =>
    this.transform.update({ pointer, minSize })

  endTransform = (pointer: PointerInput) =>
    this.transform.end({ pointer })

  cancelInteractions = () => {
    this.cancelDrag()
    this.cancelTransform()
  }
}
