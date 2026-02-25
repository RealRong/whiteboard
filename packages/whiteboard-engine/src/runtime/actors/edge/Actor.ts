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
import { createMutationCommit } from '../shared/MutationCommit'
import type { RunMutations, SubmitMutations } from '../shared/MutationCommit'
import { buildEdgeCreateOperation } from './createOperation'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'render' | 'projection' | 'query' | 'view' | 'mutate' | 'document' | 'registries'>
}

export class Actor {
  readonly name = 'Edge'

  private readonly state: ActorOptions['instance']['state']
  private readonly render: ActorOptions['instance']['render']
  private readonly instance: ActorOptions['instance']
  private readonly runMutations: RunMutations
  private readonly submitMutations: SubmitMutations

  constructor({ instance }: ActorOptions) {
    this.instance = instance
    this.state = instance.state
    this.render = instance.render
    const commit = createMutationCommit(instance.mutate)
    this.runMutations = commit.run
    this.submitMutations = commit.submit
  }

  private clearRoutingDrag = () => {
    this.render.batch(() => {
      this.render.write('routingDrag', {})
      this.render.write('interactionSession', (prev) => {
        if (prev.active?.kind !== 'routingDrag') return prev
        return {}
      })
    })
  }

  private createEdgeId = () => {
    const exists = (id: string) =>
      Boolean(this.instance.document.get().edges.some((edge) => edge.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `edge_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `edge_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  private createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })

  create = (payload: EdgeInput) => {
    const built = buildEdgeCreateOperation({
      payload,
      doc: this.instance.document.get(),
      registries: this.instance.registries,
      createEdgeId: this.createEdgeId
    })
    if (!built.ok) {
      return Promise.resolve(this.createInvalidResult(built.message))
    }
    return this.runMutations([built.operation])
  }

  update = (id: EdgeId, patch: EdgePatch) =>
    this.runMutations([{ type: 'edge.update', id, patch }])

  delete = (ids: EdgeId[]) => {
    const activeDrag = this.render.read('routingDrag').payload
    if (activeDrag && ids.includes(activeDrag.edgeId)) {
      this.clearRoutingDrag()
    }
    return this.runMutations(ids.map((id) => ({ type: 'edge.delete' as const, id })))
  }

  select = (id?: EdgeId) => {
    this.instance.state.batch(() => {
      const activeDrag = this.render.read('routingDrag').payload
      if (activeDrag && activeDrag.edgeId !== id) {
        this.clearRoutingDrag()
      }
      this.instance.state.write('selection', (prev) => {
        if (prev.selectedEdgeId === id) return prev
        return {
          ...prev,
          selectedEdgeId: id
        }
      })
    })
  }

  insertRoutingPoint = (
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
    this.submitMutations(
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

  moveRoutingPoint = (edge: Edge, index: number, pointWorld: Point) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return
    const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
    this.submitMutations(
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

  removeRoutingPoint = (edge: Edge, index: number) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return

    const activeDrag = this.render.read('routingDrag').payload
    if (activeDrag?.edgeId === edge.id && activeDrag.index === index) {
      this.clearRoutingDrag()
    }

    const nextPoints = points.filter((_, idx) => idx !== index)
    if (nextPoints.length === 0) {
      this.submitMutations(
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
    this.submitMutations(
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

  resetRouting = (edge: Edge) => {
    const activeDrag = this.render.read('routingDrag').payload
    if (activeDrag?.edgeId === edge.id) {
      this.clearRoutingDrag()
    }

    this.submitMutations(
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

  insertRoutingPointAt = (edgeId: EdgeId, pointWorld: Point) => {
    const entry = this.instance.view.getState().edges.byId.get(edgeId)
    if (!entry) return false
    const segmentIndex = this.instance.query.geometry.nearestEdgeSegment(
      pointWorld,
      entry.path.points
    )
    this.insertRoutingPoint(
      entry.edge,
      entry.path.points,
      segmentIndex,
      pointWorld
    )
    return true
  }

  removeRoutingPointAt = (edgeId: EdgeId, index: number) => {
    const entry = this.instance.view.getState().edges.byId.get(edgeId)
    if (!entry) return false
    this.removeRoutingPoint(entry.edge, index)
    return true
  }

  setOrder = (ids: EdgeId[]) =>
    this.runMutations([{ type: 'edge.order.set', ids }])

  bringToFront = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.document.get().order.edges
    return this.setOrder(bringOrderToFront(current, target))
  }

  sendToBack = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.document.get().order.edges
    return this.setOrder(sendOrderToBack(current, target))
  }

  bringForward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.document.get().order.edges
    return this.setOrder(bringOrderForward(current, target))
  }

  sendBackward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.document.get().order.edges
    return this.setOrder(sendOrderBackward(current, target))
  }
}
