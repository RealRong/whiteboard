import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveEdgeConnectPreview,
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
import type {
  ActiveInteraction,
  InteractionControl,
  InteractionPointerInput
} from '../../runtime/interaction'
import type { PointerDown } from '../../runtime/input/pointer'
import type { InteractionHost } from '../../runtime/interaction/host'
import type { EdgeGuide } from '../../runtime/overlay'
import type {
  EdgeAnchor,
  EdgeId,
  EdgeType,
  NodeId
} from '@whiteboard/core/types'
import { readEdgeType } from '../../edge/preset'

type ConnectPointer = {
  pointerId: number
  world: PointerDown['point']['world']
}
type EdgeConnectInteractionDeps = Pick<
  InteractionHost,
  'read' | 'config' | 'commands' | 'viewport' | 'overlay' | 'snap'
>

type ConnectNodeEntry = NonNullable<
  ReturnType<EdgeConnectInteractionDeps['read']['index']['node']['get']>
>

const syncState = (
  state: EdgeConnectState,
  next: EdgeConnectState
) => {
  Object.assign(state, next)
}

const clearEdgeConnectFeedback = (
  ctx: EdgeConnectInteractionDeps
): void => {
  ctx.overlay.set((current) => (
    (
      current.edge.patches.length === 0
      && current.guides.edge === undefined
    )
      ? current
      : {
          ...current,
          edge: {
            patches: []
          },
          guides: {
            ...current.guides,
            edge: undefined
          }
        }
  ))
}

const readPointer = (
  input: ConnectPointer
): ConnectPointer => ({
  pointerId: input.pointerId,
  world: input.world
})

const clearConnectPatch = (
  ctx: EdgeConnectInteractionDeps
) => {
  ctx.overlay.set((current) => (
    current.edge.patches.length === 0
      ? current
      : {
          ...current,
          edge: {
            patches: []
          }
        }
  ))
}

const readConnectNode = (
  ctx: EdgeConnectInteractionDeps,
  nodeId: NodeId
): ConnectNodeEntry | undefined => {
  const entry = ctx.read.index.node.get(nodeId)
  if (!entry || !ctx.read.node.capability(entry.node).connect) {
    return undefined
  }

  return entry
}

const readCreateState = (
  ctx: EdgeConnectInteractionDeps,
  input: PointerDown,
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
        zoom: ctx.viewport.get().zoom,
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

const readReconnectState = (
  ctx: EdgeConnectInteractionDeps,
  edgeId: EdgeId,
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

  const edgeEnd = item.edge[end]
  const resolvedEnd = resolved.ends[end]
  return startEdgeReconnect({
    pointerId: pointer.pointerId,
    edgeId,
    end,
    from: resolveReconnectDraftEnd({
      end: edgeEnd,
      point: resolvedEnd.point,
      anchor: resolvedEnd.anchor,
      anchorOffset: DEFAULT_EDGE_ANCHOR_OFFSET
    })
  })
}

const updateConnectState = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState,
  pointer: ConnectPointer
): EdgeConnectState | undefined => {
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
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState
) => {
  const commit = toEdgeConnectCommit(state)
  if (!commit) {
    return
  }

  if (commit.kind === 'reconnect') {
    ctx.commands.edge.reconnect(
      commit.edgeId,
      commit.end,
      commit.target
    )
    return
  }

  ctx.commands.edge.create(commit.input)
}

const writeStateHint = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState
) => {
  const preview = resolveEdgeConnectPreview(state)
  ctx.overlay.set((current) => ({
    ...current,
    guides: {
      ...current.guides,
      edge:
        preview
          ? {
              line: preview.line,
              snap: preview.snap
            } satisfies EdgeGuide
          : undefined
    }
  }))
}

const writeStatePatch = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState
) => {
  if (state.kind !== 'reconnect') {
    clearConnectPatch(ctx)
    return
  }

  const preview = resolveEdgeConnectPreview(state)
  if (!preview?.patch) {
    clearConnectPatch(ctx)
    return
  }

  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      patches: [{
        id: state.edgeId,
        patch: preview.patch
      }]
    }
  }))
}

const writeStatePreview = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState
) => {
  writeStateHint(ctx, state)
  writeStatePatch(ctx, state)
}

const updateActive = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState,
  input: InteractionPointerInput
) => {
  const next = updateConnectState(ctx, state, {
    pointerId: input.pointerId,
    world: input.world
  })
  if (!next) {
    return false
  }

  syncState(state, next)
  writeStatePreview(ctx, state)
  return true
}

const updateActivePointer = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState,
  pointer: {
    clientX: number
    clientY: number
  }
) => {
  const point = ctx.viewport.pointer(pointer)
  const next = updateConnectState(ctx, state, {
    pointerId: state.pointerId,
    world: point.world
  })
  if (!next) {
    return false
  }

  syncState(state, next)
  writeStatePreview(ctx, state)
  return true
}

const createActive = (
  ctx: EdgeConnectInteractionDeps,
  state: EdgeConnectState,
  control: InteractionControl
): ActiveInteraction => ({
  mode: 'edge-connect',
  pointerId: state.pointerId,
  autoPan: {
    frame: (pointer) => {
      updateActivePointer(ctx, state, pointer)
    }
  },
  move: (input) => {
    if (!updateActive(ctx, state, input)) {
      return
    }

    control.pan({
      clientX: input.client.x,
      clientY: input.client.y
    })
  },
  up: () => {
    commitConnectState(ctx, state)
    control.finish()
  },
  cleanup: () => {
    clearEdgeConnectFeedback(ctx)
  }
})

export const startEdgeCreatePhase = (
  ctx: EdgeConnectInteractionDeps,
  input: PointerDown,
  control: InteractionControl
): ActiveInteraction | null => {
  if (input.tool.type !== 'edge') {
    return null
  }

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

  const state = readCreateState(
    ctx,
    input,
    readPointer({
      pointerId: input.pointerId,
      world: input.point.world
    }),
    readEdgeType(input.tool.preset)
  )
  writeStatePreview(ctx, state)
  return createActive(ctx, state, control)
}

export const startEdgeReconnectPhase = (
  ctx: EdgeConnectInteractionDeps,
  input: PointerDown,
  control: InteractionControl
): ActiveInteraction | null => {
  if (
    input.tool.type !== 'select'
    || input.pick.kind !== 'edge'
    || input.pick.part !== 'end'
    || !input.pick.end
  ) {
    return null
  }

  const state = readReconnectState(
    ctx,
    input.pick.id,
    input.pick.end,
    readPointer({
      pointerId: input.pointerId,
      world: input.point.world
    })
  )
  if (!state || state.kind !== 'reconnect') {
    return null
  }

  ctx.commands.selection.replace({
    edgeIds: [state.edgeId]
  })
  writeStatePreview(ctx, state)

  return createActive(ctx, state, control)
}
