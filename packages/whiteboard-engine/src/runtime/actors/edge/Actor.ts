import type { EdgeConnectState } from '@engine-types/state'
import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type {
  RoutingDragCancelOptions,
  RoutingDragStartOptions
} from '@engine-types/commands'
import type { EdgeAnchor, EdgeId, NodeId } from '@whiteboard/core'
import type { SchedulerRuntime } from '../../common/contracts'
import { Connect } from './Connect'
import { Routing } from './Routing'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'graph' | 'query' | 'runtime' | 'apply'>
  schedulers: Pick<SchedulerRuntime, 'raf' | 'cancelRaf'>
}

export class Actor {
  readonly name = 'Edge'

  private readonly state: Pick<State, 'write'>
  private readonly connect: Connect
  private readonly routing: Routing

  constructor({ instance, schedulers }: ActorOptions) {
    this.state = instance.state
    this.connect = new Connect({
      instance,
      raf: schedulers.raf,
      cancelRaf: schedulers.cancelRaf
    })
    this.routing = new Routing({
      instance
    })
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
