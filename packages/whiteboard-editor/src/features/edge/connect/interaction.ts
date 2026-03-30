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
import type { EditorRuntime } from '../../../types/internal/editor'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { PointerDown } from '../../../runtime/input/pointer'
import { readEdgeType } from '../../../runtime/tool'
import {
  clearEdgeProjectionPatch,
  writeEdgeProjectionHint,
  writeEdgeProjectionPatch,
  type EdgeProjection
} from '../projection'
import type { SnapRuntime } from '../../../runtime/interaction'

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
  EditorRuntime,
  'commands' | 'config' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      overlay: {
        edge: Pick<
          EdgeProjection,
          'clear' | 'clearPatch' | 'writeHint' | 'writeEntries'
        >
      }
    }
    snap: Pick<SnapRuntime, 'edge'>
  }
}

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
  editor: EdgeConnectInteractionDeps
): EdgeConnectInteraction => {
  const clear = () => {
    editor.internals.projections.overlay.edge.clear()
  }

  const readPointer = (
    input: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: input.pointerId,
    world: editor.viewport.pointer(input).world
  })

  const clearPatch = () => {
    clearEdgeProjectionPatch(editor.internals.projections.overlay.edge)
  }

  const readConnectNode = (
    nodeId: NodeId
  ): ConnectNodeEntry | undefined => {
    const entry = editor.read.index.node.get(nodeId)
    if (!entry || !editor.read.node.connect(entry.node)) {
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
          zoom: editor.viewport.get().zoom,
          config: editor.config.edge
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
    const view = editor.read.edge.view.get(edgeId)
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

    const snap = editor.internals.snap.edge.connect(pointer.world)
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
      editor.commands.edge.reconnect(
        commit.edgeId,
        commit.end,
        commit.target
      )
      return
    }

    editor.commands.edge.create(commit.input)
  }

  const writeStateHint = (state: EdgeConnectState) => {
    writeEdgeProjectionHint(
      editor.internals.projections.overlay.edge,
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
      editor.internals.projections.overlay.edge,
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
    const point = editor.viewport.pointer(pointer)
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
        readPointer(input.event),
        readEdgeType(input.tool.preset)
      )
    },
    start: ({ input, state }) => {
      writeStatePreview(state)
      input.event.preventDefault()
      input.event.stopPropagation()
    },
    move: ({ state, session }, input) => {
      if (!updateActive(state, input)) {
        return
      }

      session.pan(input.raw)
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
        readPointer(input.event)
      ) ?? null
    },
    start: ({ input, state }) => {
      if (state.kind !== 'reconnect') {
        return
      }

      editor.commands.selection.replace({
        edgeIds: [state.edgeId]
      })
      writeStatePreview(state)
      input.event.preventDefault()
      input.event.stopPropagation()
    },
    move: ({ state, session }, input) => {
      if (!updateActive(state, input)) {
        return
      }

      session.pan(input.raw)
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
