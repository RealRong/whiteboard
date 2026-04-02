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
import {
  readEdgeType,
  type PointerDownInput
} from '../../boardRuntime'
import type {
  InteractionControl,
  InteractionSession,
  InteractionStartResult
} from '../runtime'
import { clearEdgeOverlay, writeConnectPreview } from './overlay'
import type { ConnectNodeEntry, EdgeInteractionCtx } from './types'

const readViewport = (
  ctx: EdgeInteractionCtx
) => ctx.read.viewport

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

const createEdgeConnectState = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
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
        pointerId: input.pointerId,
        edgeType,
        from: {
          kind: 'node',
          nodeId: pick.id,
          anchor,
          point: getNodeAnchorPoint(entry.node, entry.rect, anchor, entry.rotation)
        },
        to: toEdgeDraftEnd(input.world)
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
        pointWorld: input.world,
        zoom: readViewport(ctx).get().zoom,
        config: ctx.config.edge
      })

      return startEdgeCreate({
        pointerId: input.pointerId,
        edgeType,
        from: {
          kind: 'node',
          nodeId: pick.id,
          anchor: resolved.anchor,
          point: resolved.point
        },
        to: toEdgeDraftEnd(input.world)
      })
    }
  }

  return startEdgeCreate({
    pointerId: input.pointerId,
    edgeType,
    from: toEdgeDraftEnd(input.world),
    to: toEdgeDraftEnd(input.world)
  })
}

const createReconnectState = (
  ctx: EdgeInteractionCtx,
  edgeId: import('@whiteboard/core/types').EdgeId,
  end: 'source' | 'target',
  pointerId: number,
  world: PointerDownInput['world']
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
    pointerId,
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
  input: {
    pointerId: number
    world: PointerDownInput['world']
  }
) => {
  if (input.pointerId !== state.pointerId) {
    return undefined
  }

  const snap = ctx.snap.edge.connect(input.world)
  return setEdgeConnectTarget(
    state,
    toEdgeDraftEnd(input.world, snap)
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

const createConnectSession = (
  ctx: EdgeInteractionCtx,
  initial: EdgeConnectState,
  control: InteractionControl
): InteractionSession => {
  let session = initial
  writeConnectPreview(ctx, session)

  return {
    mode: 'edge-connect',
    pointerId: session.pointerId,
    autoPan: {
      frame: (pointer) => {
        const next = updateConnectState(ctx, session, {
          pointerId: session.pointerId,
          world: readViewport(ctx).pointer(pointer).world
        })
        if (!next) {
          return
        }

        session = next
        writeConnectPreview(ctx, session)
      }
    },
    move: (input) => {
      const next = updateConnectState(ctx, session, {
        pointerId: input.pointerId,
        world: input.world
      })
      if (!next) {
        return
      }

      session = next
      writeConnectPreview(ctx, session)
      control.pan({
        clientX: input.client.x,
        clientY: input.client.y
      })
    },
    up: () => {
      commitConnectState(ctx, session)
      control.finish()
    },
    cleanup: () => {
      clearEdgeOverlay(ctx)
    }
  }
}

export const startEdgeConnectInteraction = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
  control: InteractionControl
): InteractionStartResult => {
  const tool = ctx.read.tool.get()

  if (tool.type === 'edge') {
    const canStartFromNodeHandle =
      input.pick.kind === 'node'
      && input.pick.part === 'connect'
      && Boolean(input.pick.side)

    if (
      !canStartFromNodeHandle
      && (input.editable || input.ignoreInput || input.ignoreSelection)
    ) {
      return null
    }

    return {
      kind: 'session',
      session: createConnectSession(
        ctx,
        createEdgeConnectState(ctx, input, readEdgeType(tool.preset)),
        control
      )
    }
  }

  if (
    tool.type !== 'select'
    || input.pick.kind !== 'edge'
    || input.pick.part !== 'end'
    || !input.pick.end
  ) {
    return null
  }

  const state = createReconnectState(
    ctx,
    input.pick.id,
    input.pick.end,
    input.pointerId,
    input.world
  )
  if (!state || state.kind !== 'reconnect') {
    return null
  }

  ctx.commands.selection.replace({
    edgeIds: [state.edgeId]
  })

  return {
    kind: 'session',
    session: createConnectSession(ctx, state, control)
  }
}
