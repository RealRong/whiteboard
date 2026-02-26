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
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'
import { createMutationCommit } from '../../../runtime/actors/shared/MutationCommit'
import { buildEdgeCreateOperation } from './createOperation'

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
  const commit = createMutationCommit(instance.mutate)
  const runMutations = commit.run
  const submitMutations = commit.submit

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
    return runMutations([built.operation])
  }

  const update = (id: EdgeId, patch: EdgePatch) =>
    runMutations([{ type: 'edge.update', id, patch }])

  const remove = (ids: EdgeId[]) =>
    runMutations(ids.map((id) => ({ type: 'edge.delete' as const, id })))

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
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const basePoints = edge.routing?.points?.length
      ? edge.routing.points
      : pathPoints.slice(1, -1)
    const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
    const nextPoints = [...basePoints]
    nextPoints.splice(insertIndex, 0, pointWorld)
    submitMutations(
      [{
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      }]
    )
  }

  const moveRoutingPoint = (edge: Edge, index: number, pointWorld: Point) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return
    const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
    submitMutations(
      [{
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      }]
    )
  }

  const removeRoutingPoint = (edge: Edge, index: number) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return

    const nextPoints = points.filter((_, idx) => idx !== index)
    if (nextPoints.length === 0) {
      submitMutations(
        [{
          type: 'edge.update',
          id: edge.id,
          patch: {
            routing: {
              ...(edge.routing ?? {}),
              mode: 'auto',
              points: undefined
            }
          }
        }]
      )
      return
    }

    submitMutations(
      [{
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      }]
    )
  }

  const resetRouting = (edge: Edge) => {
    submitMutations(
      [{
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'auto',
            points: undefined
          }
        }
      }]
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
    runMutations([{ type: 'edge.order.set', ids }])

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
