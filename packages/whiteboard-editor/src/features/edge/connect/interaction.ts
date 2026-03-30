import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveAnchorFromPoint,
  resolveReconnectDraftEnd,
  setEdgeConnectTarget,
  startEdgeCreate,
  startEdgeReconnect,
  toEdgeConnectCommit,
  toEdgeConnectHint,
  toEdgeConnectPatch,
  toEdgeDraftEnd,
  type EdgeConnectState
} from '@whiteboard/core/edge'
import { getNodeAnchorPoint } from '@whiteboard/core/node'
import type {
  EdgeAnchor,
  EdgeId,
  EdgeType,
  NodeId
} from '@whiteboard/core/types'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { PointerDown } from '../../../runtime/input/pointer'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'
import { readEdgeType } from '../../../runtime/tool'
import {
  clearEdgeProjectionPatch,
  writeEdgeProjectionHint,
  writeEdgeProjectionPatch,
} from '../../../runtime/projection/edge'

type ConnectPointer = {
  pointerId: number
  world: PointerDown['point']['world']
}

export type EdgeConnectInteraction = {
  create: InteractionRegistration<EdgeConnectState>
  reconnect: InteractionRegistration<EdgeConnectState>
  clear: () => void
}

type EdgeConnectInteractionDeps = Pick<
  EditorFeatureContext,
  'read' | 'commands' | 'config' | 'viewport' | 'projection' | 'spatial'
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

export const createEdgeConnectInteraction = (
  ctx: EdgeConnectInteractionDeps
): EdgeConnectInteraction => {
  const clear = () => {
    ctx.projection.edge.clear()
  }

  const readPointer = (
    input: {
      pointerId: number
      world: PointerDown['point']['world']
    }
  ): ConnectPointer => ({
    pointerId: input.pointerId,
    world: input.world
  })

  const clearPatch = () => {
    clearEdgeProjectionPatch(ctx.projection.edge)
  }

  const readConnectNode = (
    nodeId: NodeId
  ): ConnectNodeEntry | undefined => {
    const entry = ctx.read.index.node.get(nodeId)
    if (!entry || !ctx.read.node.connect(entry.node)) {
      return undefined
    }

    return entry
  }

  const readCreateState = (
    input: PointerDown,
    pointer: ConnectPointer,
    edgeType: EdgeType
  ): EdgeConnectState => {
    const pick = input.pick
    if (pick.kind === 'node' && pick.part === 'connect' && pick.side) {
      const entry = readConnectNode(pick.id)
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
      const entry = readConnectNode(pick.id)
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
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: ConnectPointer
  ): EdgeConnectState | undefined => {
    const view = ctx.read.edge.view.get(edgeId)
    if (!view) {
      return undefined
    }

    if (
      (end === 'source' && !view.can.reconnectSource)
      || (end === 'target' && !view.can.reconnectTarget)
    ) {
      return undefined
    }

    const edgeEnd = view.edge[end]
    const resolvedEnd = view.ends[end]
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
    state: EdgeConnectState,
    pointer: ConnectPointer
  ): EdgeConnectState | undefined => {
    if (pointer.pointerId !== state.pointerId) {
      return undefined
    }

    const snap = ctx.spatial.snap.edge.connect(pointer.world)
    return setEdgeConnectTarget(
      state,
      toEdgeDraftEnd(pointer.world, snap)
    )
  }

  const commitConnectState = (state: EdgeConnectState) => {
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

  const writeStateHint = (state: EdgeConnectState) => {
    writeEdgeProjectionHint(
      ctx.projection.edge,
      toEdgeConnectHint(state)
    )
  }

  const writeStatePatch = (state: EdgeConnectState) => {
    if (state.kind !== 'reconnect') {
      clearPatch()
      return
    }

    const patch = toEdgeConnectPatch(state)
    if (!patch) {
      clearPatch()
      return
    }

    writeEdgeProjectionPatch(
      ctx.projection.edge,
      state.edgeId,
      patch
    )
  }

  const writeStatePreview = (state: EdgeConnectState) => {
    writeStateHint(state)
    writeStatePatch(state)
  }

  const updateActive = (
    state: EdgeConnectState,
    input: InteractionPointerInput
  ) => {
    const next = updateConnectState(state, {
      pointerId: input.pointerId,
      world: input.world
    })
    if (!next) {
      return false
    }

    syncState(state, next)
    writeStatePreview(state)
    return true
  }

  const updateActivePointer = (
    state: EdgeConnectState,
    pointer: {
      clientX: number
      clientY: number
    }
  ) => {
    const point = ctx.viewport.pointer(pointer)
    const next = updateConnectState(state, {
      pointerId: state.pointerId,
      world: point.world
    })
    if (!next) {
      return false
    }

    syncState(state, next)
    writeStatePreview(state)
    return true
  }

  const create: InteractionRegistration<EdgeConnectState> = {
    key: 'edge.create',
    priority: 500,
    mode: 'edge-connect',
    pan: (state) => ({
      frame: (pointer) => {
        updateActivePointer(state, pointer)
      }
    }),
    can: (input) => {
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

      return readCreateState(
        input,
        readPointer({
          pointerId: input.pointerId,
          world: input.point.world
        }),
        readEdgeType(input.tool.preset)
      )
    },
    start: ({ input, state }) => {
      writeStatePreview(state)
    },
    move: ({ state, session }, input) => {
      if (!updateActive(state, input)) {
        return
      }

      session.pan({
        clientX: input.client.x,
        clientY: input.client.y
      })
    },
    up: ({ state, session }) => {
      commitConnectState(state)
      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  const reconnect: InteractionRegistration<EdgeConnectState> = {
    key: 'edge.reconnect',
    priority: 390,
    mode: 'edge-connect',
    pan: (state) => ({
      frame: (pointer) => {
        updateActivePointer(state, pointer)
      }
    }),
    can: (input) => {
      if (
        input.tool.type !== 'select'
        || input.pick.kind !== 'edge'
        || input.pick.part !== 'end'
        || !input.pick.end
      ) {
        return null
      }

      return readReconnectState(
        input.pick.id,
        input.pick.end,
        readPointer({
          pointerId: input.pointerId,
          world: input.point.world
        })
      ) ?? null
    },
    start: ({ input, state }) => {
      if (state.kind !== 'reconnect') {
        return
      }

      ctx.commands.selection.replace({
        edgeIds: [state.edgeId]
      })
      writeStatePreview(state)
    },
    move: ({ state, session }, input) => {
      if (!updateActive(state, input)) {
        return
      }

      session.pan({
        clientX: input.client.x,
        clientY: input.client.y
      })
    },
    up: ({ state, session }) => {
      commitConnectState(state)
      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  return {
    create,
    reconnect,
    clear
  }
}
