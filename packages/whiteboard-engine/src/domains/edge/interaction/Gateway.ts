import type { PointerInput } from '@engine-types/common'
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
    this.connect.cancel()
    this.routingInput.cancelDraft()
  }

  hoverCancel = () => {
    this.connect.hoverCancel()
  }
}
