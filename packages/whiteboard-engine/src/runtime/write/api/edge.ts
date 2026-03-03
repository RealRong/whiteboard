import type { WriteCommandMap } from '@engine-types/command/api'
import type { CommandSource } from '@engine-types/command/source'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { EdgeCommandsApi } from '@engine-types/write/commands'
import type {
  Edge,
  EdgeId,
  EdgeInput,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'
import type { Apply } from '../stages/plan/draft'

type EdgeCommand = WriteCommandMap['edge']

export const edge = ({
  instance,
  apply
}: {
  instance: Pick<InternalInstance, 'state' | 'query' | 'read' | 'document'>
  apply: Apply
}): EdgeCommandsApi => {
  const run = (command: EdgeCommand, source: CommandSource = 'ui') =>
    apply({
      domain: 'edge',
      command,
      source
    })

  const create = (payload: EdgeInput) =>
    run({ type: 'create', payload })

  const update = (id: EdgeId, patch: EdgePatch) =>
    run({ type: 'update', id, patch })

  const remove = (ids: EdgeId[]) =>
    run({ type: 'delete', ids })

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
    item: Edge,
    pathPoints: Point[],
    segmentIndex: number,
    pointWorld: Point
  ) => {
    void run({
      type: 'routing.insert',
      edge: item,
      pathPoints,
      segmentIndex,
      pointWorld
    })
  }

  const moveRoutingPoint = (item: Edge, index: number, pointWorld: Point) => {
    void run({
      type: 'routing.move',
      edge: item,
      index,
      pointWorld
    })
  }

  const removeRoutingPoint = (item: Edge, index: number) => {
    void run({
      type: 'routing.remove',
      edge: item,
      index
    })
  }

  const resetRouting = (item: Edge) => {
    void run({
      type: 'routing.reset',
      edge: item
    })
  }

  const insertRoutingPointAt = (edgeId: EdgeId, pointWorld: Point) => {
    const entry = instance.read.get.edgeById(edgeId)
    if (!entry) return false
    const segmentIndex = instance.query.geometry.nearestEdgeSegment(
      pointWorld,
      entry.path.points
    )
    insertRoutingPoint(entry.edge, entry.path.points, segmentIndex, pointWorld)
    return true
  }

  const removeRoutingPointAt = (edgeId: EdgeId, index: number) => {
    const entry = instance.read.get.edgeById(edgeId)
    if (!entry) return false
    removeRoutingPoint(entry.edge, index)
    return true
  }

  const setOrder = (ids: EdgeId[]) =>
    run({ type: 'order.set', ids })

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
