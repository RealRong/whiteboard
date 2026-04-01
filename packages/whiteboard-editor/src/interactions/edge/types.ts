import type { EdgeConnectState } from '@whiteboard/core/edge'
import type {
  EdgeId,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { InteractionOwner } from '../../runtime/interaction'
import type { InteractionCtx } from '../../runtime/interaction/ctx'
import type { PointerDownInput } from '../../types/input'

export type EdgeInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'config' | 'commands' | 'state' | 'overlay' | 'snap'
>

export type ConnectPointer = {
  pointerId: number
  world: PointerDownInput['world']
}

export type BodyMoveState = {
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
}

export type RouteDragState = {
  kind: 'drag'
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

export type RouteState =
  | RouteDragState
  | {
      kind: 'insert'
      edgeId: EdgeId
      worldPoint: Point
    }
  | {
      kind: 'remove'
      edgeId: EdgeId
      index: number
    }

export type EdgeSession =
  | {
      kind: 'connect'
      state: EdgeConnectState
    }
  | {
      kind: 'moveBody'
      state: BodyMoveState
    }
  | {
      kind: 'insertBodyRoute'
      edgeId: EdgeId
    }
  | {
      kind: 'route'
      state: RouteState
    }

export type EdgeRoutePick = Extract<PointerDownInput['pick'], {
  kind: 'edge'
}> & {
  part: 'path'
}

export type RoutePoint =
  | {
      kind: 'anchor'
      edgeId: EdgeId
      index: number
      point: Point
    }
  | {
      kind: 'insert'
      edgeId: EdgeId
      insertIndex: number
      point: Point
    }

export type ConnectNodeEntry = NonNullable<
  ReturnType<EdgeInteractionCtx['read']['index']['node']['get']>
>

export type EdgeInteraction = {
  owner: InteractionOwner
  clear: () => void
}

export const readViewport = (
  ctx: EdgeInteractionCtx
) => ctx.state.viewport.read

export const readPointer = (
  input: ConnectPointer
): ConnectPointer => ({
  pointerId: input.pointerId,
  world: input.world
})
