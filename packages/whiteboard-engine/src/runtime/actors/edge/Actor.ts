import type { EdgeConnectState } from '@engine-types/state'
import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type {
  RoutingDragCancelOptions,
  RoutingDragStartOptions
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
  Point
} from '@whiteboard/core'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core'
import type { Scheduler } from '../../common/contracts'
import { MutationExecutor } from '../shared/MutationExecutor'
import { Connect } from './Connect'
import { Routing } from './Routing'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'graph' | 'query' | 'runtime' | 'view' | 'mutate'>
  registries: CoreRegistries
  scheduler: Scheduler
  mutation: MutationExecutor
}

export class Actor {
  readonly name = 'Edge'

  private readonly state: Pick<State, 'write'>
  private readonly instance: ActorOptions['instance']
  private readonly mutation: MutationExecutor
  private readonly connect: Connect
  private readonly routing: Routing

  constructor({ instance, registries, scheduler, mutation }: ActorOptions) {
    this.instance = instance
    this.state = instance.state
    this.mutation = mutation
    this.connect = new Connect({
      instance,
      registries,
      scheduler
    })
    this.routing = new Routing({
      instance
    })
  }

  private clearRoutingDrag = () => {
    this.instance.state.write('routingDrag', {})
  }

  create = (payload: EdgeInput) =>
    this.mutation.runCommand({ type: 'edge.create', payload }, 'edge.create')

  update = (id: EdgeId, patch: EdgePatch) =>
    this.mutation.runCommand({ type: 'edge.update', id, patch }, 'edge.update')

  delete = (ids: EdgeId[]) => {
    const activeDrag = this.instance.state.read('routingDrag').active
    if (activeDrag && ids.includes(activeDrag.edgeId)) {
      this.clearRoutingDrag()
    }
    return this.mutation.runCommand({ type: 'edge.delete', ids }, 'edge.delete')
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
    void this.mutation.runCommand({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    }, 'edge.insertRoutingPoint')
  }

  moveRoutingPoint = (edge: Edge, index: number, pointWorld: Point) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return
    const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
    void this.mutation.runCommand({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    }, 'edge.moveRoutingPoint')
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
      void this.mutation.runCommand({
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'auto',
            points: undefined
          }
        }
      }, 'edge.removeRoutingPoint')
      return
    }
    void this.mutation.runCommand({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    }, 'edge.removeRoutingPoint')
  }

  resetRouting = (edge: Edge) => {
    const activeDrag = this.instance.state.read('routingDrag').active
    if (activeDrag?.edgeId === edge.id) {
      this.clearRoutingDrag()
    }

    void this.mutation.runCommand({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'auto',
          points: undefined
        }
      }
    }, 'edge.resetRouting')
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
    this.mutation.runCommand({ type: 'edge.order.set', ids }, 'order.edge.set')

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

  startRouting = (options: RoutingDragStartOptions) =>
    this.routing.start(options)

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
