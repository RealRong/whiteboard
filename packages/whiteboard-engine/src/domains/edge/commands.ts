import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  Edge,
  EdgeId,
  EdgeInput,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import {
  buildEdgeCreateOperation,
  insertRoutingPoint as insertRoutingPointPatch,
  moveRoutingPoint as moveRoutingPointPatch,
  removeRoutingPoint as removeRoutingPointPatch,
  resetRouting as resetRoutingPatch
} from '@whiteboard/core/edge'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'

type EdgeCommandsInstance = Pick<
  InternalInstance,
  'state' | 'projection' | 'query' | 'view' | 'mutate' | 'document' | 'registries'
>

type Options = {
  instance: EdgeCommandsInstance
}

const createInvalidResult = (message: string): DispatchResult => ({
  ok: false,
  reason: 'invalid',
  message
})

export const createEdgeCommands = ({ instance }: Options) => {
  const createEdgeId = () => {
    const exists = (id: string) =>
      Boolean(instance.document.get().edges.some((edge) => edge.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `edge_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `edge_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  const create = (payload: EdgeInput) => {
    const built = buildEdgeCreateOperation({
      payload,
      doc: instance.document.get(),
      registries: instance.registries,
      createEdgeId
    })
    if (!built.ok) {
      return Promise.resolve(createInvalidResult(built.message))
    }
    return instance.mutate([built.operation], 'ui')
  }

  const update = (id: EdgeId, patch: EdgePatch) =>
    instance.mutate([{ type: 'edge.update', id, patch }], 'ui')

  const remove = (ids: EdgeId[]) =>
    instance.mutate(ids.map((id) => ({ type: 'edge.delete' as const, id })), 'ui')

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

  const insertRoutingPoint = (
    edge: Edge,
    pathPoints: Point[],
    segmentIndex: number,
    pointWorld: Point
  ) => {
    const patch = insertRoutingPointPatch(edge, pathPoints, segmentIndex, pointWorld)
    if (!patch) return
    void instance.mutate(
      [{
        type: 'edge.update',
        id: edge.id,
        patch
      }],
      'ui'
    )
  }

  const moveRoutingPoint = (edge: Edge, index: number, pointWorld: Point) => {
    const patch = moveRoutingPointPatch(edge, index, pointWorld)
    if (!patch) return
    void instance.mutate(
      [{
        type: 'edge.update',
        id: edge.id,
        patch
      }],
      'ui'
    )
  }

  const removeRoutingPoint = (edge: Edge, index: number) => {
    const patch = removeRoutingPointPatch(edge, index)
    if (!patch) return
    void instance.mutate(
      [{
        type: 'edge.update',
        id: edge.id,
        patch
      }],
      'ui'
    )
  }

  const resetRouting = (edge: Edge) => {
    const patch = resetRoutingPatch(edge)
    void instance.mutate(
      [{
        type: 'edge.update',
        id: edge.id,
        patch
      }],
      'ui'
    )
  }

  const insertRoutingPointAt = (edgeId: EdgeId, pointWorld: Point) => {
    const entry = instance.view.getState().edges.byId.get(edgeId)
    if (!entry) return false
    const segmentIndex = instance.query.geometry.nearestEdgeSegment(
      pointWorld,
      entry.path.points
    )
    insertRoutingPoint(
      entry.edge,
      entry.path.points,
      segmentIndex,
      pointWorld
    )
    return true
  }

  const removeRoutingPointAt = (edgeId: EdgeId, index: number) => {
    const entry = instance.view.getState().edges.byId.get(edgeId)
    if (!entry) return false
    removeRoutingPoint(entry.edge, index)
    return true
  }

  const setOrder = (ids: EdgeId[]) =>
    instance.mutate([{ type: 'edge.order.set', ids }], 'ui')

  const bringToFront = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(bringOrderToFront(current, target))
  }

  const sendToBack = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(sendOrderToBack(current, target))
  }

  const bringForward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(bringOrderForward(current, target))
  }

  const sendBackward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(sendOrderBackward(current, target))
  }

  return {
    create,
    update,
    delete: remove,
    select,
    insertRoutingPoint,
    moveRoutingPoint,
    removeRoutingPoint,
    resetRouting,
    insertRoutingPointAt,
    removeRoutingPointAt,
    setOrder,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward
  }
}

export type EdgeCommandsApi = ReturnType<typeof createEdgeCommands>
