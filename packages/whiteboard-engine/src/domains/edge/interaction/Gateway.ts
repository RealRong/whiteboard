import type { PointerInput } from '@engine-types/common'
import type { EdgeConnectDraft } from '@engine-types/edge'
import type { RoutingDragPayload } from '@engine-types/edge/routing'
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
  private readonly render: GatewayInstance['render']
  private readonly connect: Connect
  private readonly routing: Routing
  private readonly edgeCommands: EdgeCommands

  constructor({ instance, scheduler, edgeCommands }: GatewayOptions) {
    this.edgeCommands = edgeCommands
    this.writer = new RuntimeWriter({
      instance
    })
    this.render = instance.render
    this.connect = new Connect({
      instance,
      scheduler,
      emit: this.emit
    })
    this.routing = new Routing({
      instance
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
    const activeDrag = this.render.read('routingDrag').payload
    if (activeDrag?.edgeId === edgeId && activeDrag.index === index) {
      this.routingInput.cancelDraft()
    }
    return this.edgeCommands.removeRoutingPointAt(edgeId, index)
  }

  private readActiveConnectDraft = (pointerId?: number): EdgeConnectDraft | undefined => {
    const active = this.render.read('interactionSession').active
    if (!active || active.kind !== 'edgeConnect') return undefined
    if (pointerId !== undefined && active.pointerId !== pointerId) {
      return undefined
    }
    const state = this.render.read('edgeConnect')
    if (!state.from) return undefined
    return {
      pointerId: active.pointerId,
      from: state.from,
      to: state.to,
      reconnect: state.reconnect
    }
  }

  private beginConnect = (
    pointerId: number,
    start: () => void
  ) => {
    const active = this.render.read('interactionSession').active
    if (active) return undefined
    start()
    return this.readActiveConnectDraft(pointerId)
  }

  connectInput = {
    beginFromHandle: (options: {
      nodeId: NodeId
      side: EdgeAnchor['side']
      pointer: PointerInput
    }) =>
      this.beginConnect(options.pointer.pointerId, () => {
        this.connect.beginFromHandle(
          options.nodeId,
          options.side,
          options.pointer
        )
      }),
    beginFromNode: (options: {
      nodeId: NodeId
      pointer: PointerInput
    }) =>
      this.beginConnect(options.pointer.pointerId, () => {
        this.connect.beginFromNode(
          options.nodeId,
          options.pointer
        )
      }),
    beginReconnect: (options: {
      edgeId: EdgeId
      end: 'source' | 'target'
      pointer: PointerInput
    }) =>
      this.beginConnect(options.pointer.pointerId, () => {
        this.connect.beginReconnect(
          options.edgeId,
          options.end,
          options.pointer
        )
      }),
    updateDraft: (options: {
      draft: EdgeConnectDraft
      pointer: PointerInput
    }) => {
      const { draft, pointer } = options
      if (pointer.pointerId !== draft.pointerId) return false
      const active = this.render.read('interactionSession').active
      if (
        !active
        || active.kind !== 'edgeConnect'
        || active.pointerId !== draft.pointerId
      ) {
        return false
      }
      this.connect.updateDraft(pointer)
      const next = this.readActiveConnectDraft(draft.pointerId)
      if (!next) return false
      draft.from = next.from
      draft.to = next.to
      draft.reconnect = next.reconnect
      return true
    },
    commitDraft: (draft: EdgeConnectDraft) => {
      const active = this.render.read('interactionSession').active
      if (
        !active
        || active.kind !== 'edgeConnect'
        || active.pointerId !== draft.pointerId
      ) {
        return false
      }
      this.connect.commitDraft()
      return true
    },
    cancelDraft: (options?: { draft?: EdgeConnectDraft }) => {
      const active = this.render.read('interactionSession').active
      if (!active || active.kind !== 'edgeConnect') return false
      if (options?.draft && active.pointerId !== options.draft.pointerId) {
        return false
      }
      this.connect.cancelDraft()
      return true
    },
    hoverMove: (pointer: PointerInput | undefined, enabled: boolean) => {
      this.connect.hoverMove(pointer, enabled)
    },
    hoverCancel: () => {
      this.connect.hoverCancel()
    }
  }

  routingInput = {
    begin: (options: {
      edgeId: EdgeId
      index: number
      pointer: PointerInput
    }) => {
      const active = this.render.read('interactionSession').active
      if (active) return undefined
      const draft = this.routing.begin(options)
      if (!draft) return undefined
      this.emit({
        routingDrag: {
          payload: draft
        },
        interaction: {
          kind: 'routingDrag',
          pointerId: draft.pointerId
        },
        selection: (prev) => {
          if (prev.selectedEdgeId === draft.edgeId) return prev
          return {
            ...prev,
            selectedEdgeId: draft.edgeId
          }
        }
      })
      return draft
    },
    insertRoutingPointAt: (edgeId: EdgeId, pointWorld: Point) =>
      this.insertRoutingPoint(edgeId, pointWorld),
    removeRoutingPointAt: (edgeId: EdgeId, index: number) =>
      this.removeRoutingPoint(edgeId, index),
    updateDraft: (options: {
      draft: RoutingDragPayload
      pointer: PointerInput
    }) => {
      const { draft, pointer } = options
      if (pointer.pointerId !== draft.pointerId) return false
      const active = this.render.read('interactionSession').active
      if (
        !active
        || active.kind !== 'routingDrag'
        || active.pointerId !== draft.pointerId
      ) {
        return false
      }
      const next = this.routing.update(draft, pointer)
      if (!next) {
        this.routingInput.cancelDraft({ draft })
        return false
      }
      draft.point = next.point
      this.emit({
        frame: true,
        routingDrag: {
          payload: next
        }
      })
      return true
    },
    commitDraft: (draft: RoutingDragPayload) => {
      const active = this.render.read('interactionSession').active
      if (
        !active
        || active.kind !== 'routingDrag'
        || active.pointerId !== draft.pointerId
      ) {
        return false
      }
      this.emit({
        mutations: this.routing.commit(draft),
        routingDrag: {},
        interaction: {
          kind: 'routingDrag',
          pointerId: null
        }
      })
      return true
    },
    cancelDraft: (options?: { draft?: RoutingDragPayload }) => {
      const active = this.render.read('interactionSession').active
      if (!active || active.kind !== 'routingDrag') return false
      if (options?.draft && active.pointerId !== options.draft.pointerId) {
        return false
      }
      this.emit({
        routingDrag: {},
        interaction: {
          kind: 'routingDrag',
          pointerId: null
        }
      })
      return true
    }
  }

  resetTransientState = () => {
    this.connect.hoverCancel()
    this.emit({
      edgeConnect: {},
      routingDrag: {},
      clearInteractions: ['edgeConnect', 'routingDrag']
    })
  }

  cancelInteractions = () => {
    this.connect.cancelDraft()
    this.routingInput.cancelDraft()
  }

  hoverCancel = () => {
    this.connect.hoverCancel()
  }
}
