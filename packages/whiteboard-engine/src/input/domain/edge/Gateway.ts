import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import { createMutationCommit } from '../../../runtime/actors/shared/MutationCommit'
import type { Scheduler } from '../../../runtime/Scheduler'
import { Connect } from './Connect'
import { Routing } from './Routing'

type GatewayInstance = Pick<
  InternalInstance,
  'state' | 'projection' | 'query' | 'view' | 'mutate' | 'document' | 'registries' | 'config' | 'viewport'
>

type GatewayOptions = {
  instance: GatewayInstance
  scheduler: Scheduler
}

export class EdgeInputGateway {
  private readonly instance: GatewayInstance
  private readonly state: GatewayInstance['state']
  private readonly submitMutations: ReturnType<typeof createMutationCommit>['submit']
  private readonly connect: Connect
  private readonly routing: Routing

  constructor({ instance, scheduler }: GatewayOptions) {
    this.instance = instance
    this.state = instance.state
    const commit = createMutationCommit(instance.mutate)
    this.submitMutations = commit.submit
    this.connect = new Connect({
      instance,
      scheduler,
      submitMutations: commit.submit
    })
    this.routing = new Routing({
      instance,
      submitMutations: commit.submit
    })
  }

  private insertRoutingPoint = (
    edgeId: EdgeId,
    pointWorld: Point
  ) => {
    const entry = this.instance.view.getState().edges.byId.get(edgeId)
    if (!entry) return false
    if (entry.edge.type === 'bezier' || entry.edge.type === 'curve') return false

    const basePoints = entry.edge.routing?.points?.length
      ? entry.edge.routing.points
      : entry.path.points.slice(1, -1)
    const segmentIndex = this.instance.query.geometry.nearestEdgeSegment(
      pointWorld,
      entry.path.points
    )
    const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
    const nextPoints = [...basePoints]
    nextPoints.splice(insertIndex, 0, pointWorld)

    this.submitMutations([
      {
        type: 'edge.update',
        id: entry.edge.id,
        patch: {
          routing: {
            ...(entry.edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      }
    ], 'interaction')
    return true
  }

  private removeRoutingPoint = (
    edgeId: EdgeId,
    index: number
  ) => {
    const entry = this.instance.view.getState().edges.byId.get(edgeId)
    if (!entry) return false
    if (entry.edge.type === 'bezier' || entry.edge.type === 'curve') return false

    const points = entry.edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return false

    const activeDrag = this.routing.getPayload()
    if (activeDrag?.edgeId === edgeId && activeDrag.index === index) {
      this.routing.reset()
    }

    const nextPoints = points.filter((_, idx) => idx !== index)
    if (!nextPoints.length) {
      this.submitMutations([
        {
          type: 'edge.update',
          id: edgeId,
          patch: {
            routing: {
              ...(entry.edge.routing ?? {}),
              mode: 'auto',
              points: undefined
            }
          }
        }
      ], 'interaction')
      return true
    }

    this.submitMutations([
      {
        type: 'edge.update',
        id: edgeId,
        patch: {
          routing: {
            ...(entry.edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      }
    ], 'interaction')
    return true
  }

  connectInput = {
    startFromHandle: (
      nodeId: NodeId,
      side: EdgeAnchor['side'],
      pointer: PointerInput
    ) => {
      this.connect.startFromHandle(nodeId, side, pointer)
    },
    startReconnect: (
      edgeId: EdgeId,
      end: 'source' | 'target',
      pointer: PointerInput
    ) => {
      this.connect.startReconnect(edgeId, end, pointer)
    },
    handleNodePointerDown: (
      nodeId: NodeId,
      pointer: PointerInput
    ) =>
      this.connect.handleNodePointerDown(nodeId, pointer),
    updateConnect: (pointer: PointerInput) => {
      this.connect.updateTo(pointer)
    },
    commitConnect: (pointer: PointerInput) => {
      this.connect.commitTo(pointer)
    },
    cancelConnect: () => {
      this.connect.cancel()
    },
    hoverMove: (pointer: PointerInput | undefined, enabled: boolean) => {
      this.connect.hoverMove(pointer, enabled)
    },
    hoverCancel: () => {
      this.connect.hoverCancel()
    }
  }

  routingInput = {
    startRouting: (
      edgeId: EdgeId,
      index: number,
      pointer: PointerInput
    ) =>
      this.routing.start({ edgeId, index, pointer }),
    insertRoutingPointAt: (edgeId: EdgeId, pointWorld: Point) =>
      this.insertRoutingPoint(edgeId, pointWorld),
    removeRoutingPointAt: (edgeId: EdgeId, index: number) =>
      this.removeRoutingPoint(edgeId, index),
    updateRouting: (pointer: PointerInput) =>
      this.routing.update({ pointer }),
    endRouting: (pointer: PointerInput) =>
      this.routing.end({ pointer }),
    cancelRouting: () => this.routing.cancel()
  }

  private clearInteractionIfNeeded = () => {
    this.state.write('interactionSession', (prev) => {
      if (
        prev.active?.kind !== 'edgeConnect' &&
        prev.active?.kind !== 'routingDrag'
      ) {
        return prev
      }
      return {}
    })
  }

  resetTransientState = () => {
    this.connect.hoverCancel()
    this.state.batch(() => {
      this.state.write('edgeConnect', {})
      this.routing.reset()
      this.clearInteractionIfNeeded()
    })
  }

  cancelInteractions = () => {
    this.connect.cancel()
    this.routing.cancel()
  }

  hoverCancel = () => {
    this.connect.hoverCancel()
  }
}
