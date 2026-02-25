import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { Scheduler } from '../../../runtime/Scheduler'
import { Connect } from './Connect'
import { Routing } from './Routing'
import type { RuntimeOutput } from './RuntimeOutput'
import { RuntimeWriter } from './RuntimeWriter'

type GatewayInstance = Pick<
  InternalInstance,
  'state' | 'render' | 'projection' | 'query' | 'mutate' | 'document' | 'registries' | 'config' | 'viewport'
>

type EdgeCommands = {
  insertRoutingPointAt: (edgeId: EdgeId, pointWorld: Point) => boolean
  removeRoutingPointAt: (edgeId: EdgeId, index: number) => boolean
}

type GatewayOptions = {
  instance: GatewayInstance
  scheduler: Scheduler
  edgeCommands: EdgeCommands
}

export class EdgeInputGateway {
  private readonly writer: RuntimeWriter
  private readonly connect: Connect
  private readonly routing: Routing
  private readonly edgeCommands: EdgeCommands

  constructor({ instance, scheduler, edgeCommands }: GatewayOptions) {
    this.edgeCommands = edgeCommands
    this.writer = new RuntimeWriter({
      instance
    })
    this.connect = new Connect({
      instance,
      scheduler,
      emit: this.emit
    })
    this.routing = new Routing({
      instance,
      emit: this.emit
    })
  }

  private emit = (output: RuntimeOutput) => {
    this.writer.apply(output)
  }

  private insertRoutingPoint = (
    edgeId: EdgeId,
    pointWorld: Point
  ) =>
    this.edgeCommands.insertRoutingPointAt(edgeId, pointWorld)

  private removeRoutingPoint = (
    edgeId: EdgeId,
    index: number
  ) => {
    const activeDrag = this.routing.getPayload()
    if (activeDrag?.edgeId === edgeId && activeDrag.index === index) {
      this.routing.reset()
    }
    return this.edgeCommands.removeRoutingPointAt(edgeId, index)
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

  resetTransientState = () => {
    this.connect.hoverCancel()
    this.routing.reset()
    this.emit({
      edgeConnect: {},
      clearInteractions: ['edgeConnect', 'routingDrag']
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
