import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveReconnectDraftEnd,
  setEdgeConnectTarget,
  startEdgeCreate,
  startEdgeReconnect,
  toEdgeConnectCommit,
  toEdgeDraftEnd,
  type EdgeConnectState
} from '@whiteboard/core/edge'
import { getNodeAnchorPoint } from '@whiteboard/core/node'
import type { EdgeAnchor, EdgeType, NodeId } from '@whiteboard/core/types'
import type { InteractionControl, InteractionSession } from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import { clearEdgeOverlay, writeConnectPreview } from './overlay'
import type { ConnectNodeEntry, ConnectPointer, EdgeInteractionCtx } from './types'
import { readViewport } from './types'

const readConnectNode = (
  ctx: EdgeInteractionCtx,
  nodeId: NodeId
): ConnectNodeEntry | undefined => {
  const entry = ctx.read.index.node.get(nodeId)
  if (!entry || !ctx.read.node.capability(entry.node).connect) {
    return undefined
  }

  return entry
}

export const startEdgeCreateSession = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
  pointer: ConnectPointer,
  edgeType: EdgeType
): EdgeConnectState => {
  const pick = input.pick
  if (pick.kind === 'node' && pick.part === 'connect' && pick.side) {
    const entry = readConnectNode(ctx, pick.id)
    if (entry) {
      const anchor: EdgeAnchor = {
        side: pick.side,
        offset: DEFAULT_EDGE_ANCHOR_OFFSET
      }

      return startEdgeCreate({
        pointerId: pointer.pointerId,
        edgeType,
        from: {
          kind: 'node',
          nodeId: pick.id,
          anchor,
          point: getNodeAnchorPoint(entry.node, entry.rect, anchor, entry.rotation)
        },
        to: toEdgeDraftEnd(pointer.world)
      })
    }
  }

  if (
    pick.kind === 'node'
    && (pick.part === 'body' || pick.part === 'shell')
  ) {
    const entry = readConnectNode(ctx, pick.id)
    if (entry) {
      const resolved = resolveAnchorFromPoint({
        node: entry.node,
        rect: entry.rect,
        rotation: entry.rotation,
        pointWorld: pointer.world,
        zoom: readViewport(ctx).get().zoom,
        config: ctx.config.edge
      })

      return startEdgeCreate({
        pointerId: pointer.pointerId,
        edgeType,
        from: {
          kind: 'node',
          nodeId: pick.id,
          anchor: resolved.anchor,
          point: resolved.point
        },
        to: toEdgeDraftEnd(pointer.world)
      })
    }
  }

  return startEdgeCreate({
    pointerId: pointer.pointerId,
    edgeType,
    from: toEdgeDraftEnd(pointer.world),
    to: toEdgeDraftEnd(pointer.world)
  })
}

export const startEdgeReconnectSession = (
  ctx: EdgeInteractionCtx,
  edgeId: import('@whiteboard/core/types').EdgeId,
  end: 'source' | 'target',
  pointer: ConnectPointer
): EdgeConnectState | undefined => {
  const item = ctx.read.edge.item.get(edgeId)
  const resolved = ctx.read.edge.resolved.get(edgeId)
  if (!item || !resolved) {
    return undefined
  }

  const capability = ctx.read.edge.capability(item.edge)
  if (
    (end === 'source' && !capability.reconnectSource)
    || (end === 'target' && !capability.reconnectTarget)
  ) {
    return undefined
  }

  return startEdgeReconnect({
    pointerId: pointer.pointerId,
    edgeId,
    end,
    from: resolveReconnectDraftEnd({
      end: item.edge[end],
      point: resolved.ends[end].point,
      anchor: resolved.ends[end].anchor,
      anchorOffset: DEFAULT_EDGE_ANCHOR_OFFSET
    })
  })
}

const updateConnectState = (
  ctx: EdgeInteractionCtx,
  state: EdgeConnectState,
  pointer: ConnectPointer
) => {
  if (pointer.pointerId !== state.pointerId) {
    return undefined
  }

  const snap = ctx.snap.edge.connect(pointer.world)
  return setEdgeConnectTarget(
    state,
    toEdgeDraftEnd(pointer.world, snap)
  )
}

const commitConnectState = (
  ctx: EdgeInteractionCtx,
  state: EdgeConnectState
) => {
  const commit = toEdgeConnectCommit(state)
  if (!commit) {
    return
  }

  if (commit.kind === 'reconnect') {
    ctx.commands.edge.reconnect(commit.edgeId, commit.end, commit.target)
    return
  }

  ctx.commands.edge.create(commit.input)
}

export const createConnectInteraction = (
  ctx: EdgeInteractionCtx,
  state: EdgeConnectState,
  control: InteractionControl
): InteractionSession => {
  writeConnectPreview(ctx, state)

  return {
    mode: 'edge-connect',
    pointerId: state.pointerId,
    autoPan: {
      frame: (pointer) => {
        const next = updateConnectState(ctx, state, {
          pointerId: state.pointerId,
          world: readViewport(ctx).pointer(pointer).world
        })
        if (!next) {
          return
        }

        Object.assign(state, next)
        writeConnectPreview(ctx, state)
      }
    },
    move: (nextInput) => {
      const next = updateConnectState(ctx, state, {
        pointerId: nextInput.pointerId,
        world: nextInput.world
      })
      if (!next) {
        return
      }

      Object.assign(state, next)
      writeConnectPreview(ctx, state)
      control.pan({
        clientX: nextInput.client.x,
        clientY: nextInput.client.y
      })
    },
    up: () => {
      commitConnectState(ctx, state)
      control.finish()
    },
    cleanup: () => {
      clearEdgeOverlay(ctx)
    }
  }
}
