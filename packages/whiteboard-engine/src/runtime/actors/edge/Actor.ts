import type { EdgeConnectState } from '@engine-types/state'
import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type { ApplyMutationsApi } from '@engine-types/command'
import type {
  RoutingDragCancelOptions
} from '@engine-types/commands'
import type {
  CoreRegistries,
  DispatchResult,
  Edge,
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  Operation,
  Point
} from '@whiteboard/core/types'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'
import type { Scheduler } from '../../contracts'
import { createMutationCommit } from '../shared/MutationCommit'
import type { RunMutations, SubmitMutations } from '../shared/MutationCommit'
import { Connect } from './Connect'
import { Routing } from './Routing'
import { buildEdgeCreateOperation } from './createOperation'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'projection' | 'query' | 'runtime' | 'view'>
  registries: CoreRegistries
  scheduler: Scheduler
  mutate: ApplyMutationsApi
}

export class Actor {
  readonly name = 'Edge'

  private readonly state: Pick<State, 'write'>
  private readonly instance: ActorOptions['instance']
  private readonly registries: CoreRegistries
  private readonly runMutations: RunMutations
  private readonly submitMutations: SubmitMutations
  private readonly connect: Connect
  private readonly routing: Routing

  constructor({ instance, registries, scheduler, mutate }: ActorOptions) {
    this.instance = instance
    this.state = instance.state
    this.registries = registries
    const commit = createMutationCommit(mutate)
    this.runMutations = commit.run
    this.submitMutations = commit.submit
    this.connect = new Connect({
      instance,
      registries,
      scheduler,
      submitMutations: this.submitMutations
    })
    this.routing = new Routing({
      instance,
      submitMutations: this.submitMutations
    })
  }

  private clearRoutingDrag = () => {
    this.instance.state.write('routingDrag', {})
  }

  private createEdgeId = () => {
    const exists = (id: string) =>
      Boolean(this.instance.runtime.document.get().edges.some((edge) => edge.id === id))
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
      doc: this.instance.runtime.document.get(),
      registries: this.registries,
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
    const activeDrag = this.instance.state.read('routingDrag').active
    if (activeDrag && ids.includes(activeDrag.edgeId)) {
      this.clearRoutingDrag()
    }
    return this.runMutations(ids.map((id) => ({ type: 'edge.delete' as const, id })))
  }

  select = (id?: EdgeId) => {
    this.instance.state.batch(() => {
      const activeDrag = this.instance.state.read('routingDrag').active
      if (activeDrag && activeDrag.edgeId !== id) {
        this.clearRoutingDrag()
      }
      this.instance.state.write('edgeSelection', (prev) => (prev === id ? prev : id))
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

    const activeDrag = this.instance.state.read('routingDrag').active
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
    const activeDrag = this.instance.state.read('routingDrag').active
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
    const current = this.instance.runtime.document.get().order.edges
    return this.setOrder(bringOrderToFront(current, target))
  }

  sendToBack = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.document.get().order.edges
    return this.setOrder(sendOrderToBack(current, target))
  }

  bringForward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.document.get().order.edges
    return this.setOrder(bringOrderForward(current, target))
  }

  sendBackward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = this.instance.runtime.document.get().order.edges
    return this.setOrder(sendOrderBackward(current, target))
  }

  resetTransientState = () => {
    this.state.write('edgeConnect', { isConnecting: false } as EdgeConnectState)
    this.state.write('routingDrag', {})
  }

  startFromHandle = (
    nodeId: NodeId,
    side: EdgeAnchor['side'],
    pointer: PointerInput
  ) => {
    this.connect.startFromHandle(nodeId, side, pointer)
  }

  startFromPoint = (nodeId: NodeId, pointer: PointerInput) => {
    this.connect.startFromPoint(nodeId, pointer)
  }

  startReconnect = (
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: PointerInput
  ) => {
    this.connect.startReconnect(edgeId, end, pointer)
  }

  handleNodePointerDown = (nodeId: NodeId, pointer: PointerInput) =>
    this.connect.handleNodePointerDown(nodeId, pointer)

  startRouting = (
    edgeId: EdgeId,
    index: number,
    pointer: PointerInput
  ) =>
    this.routing.start({ edgeId, index, pointer })

  hoverMove = (pointer: PointerInput | undefined, enabled: boolean) => {
    this.connect.hoverMove(pointer, enabled)
  }

  hoverCancel = () => {
    this.connect.hoverCancel()
  }

  cancelConnect = () => this.connect.cancel()

  cancelRouting = (options?: RoutingDragCancelOptions) =>
    this.routing.cancel(options)

  updateConnect = (pointer: PointerInput) => {
    this.connect.updateTo(pointer)
  }

  commitConnect = (pointer: PointerInput) => {
    this.connect.commitTo(pointer)
  }

  updateRouting = (pointer: PointerInput) =>
    this.routing.update({ pointer })

  endRouting = (pointer: PointerInput) =>
    this.routing.end({ pointer })

  cancelInteractions = () => {
    this.cancelConnect()
    this.hoverCancel()
    this.cancelRouting()
  }
}
