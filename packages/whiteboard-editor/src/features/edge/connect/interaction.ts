import {
  resolveAnchorFromPoint
} from '@whiteboard/core/edge'
import { getNodeAnchorPoint } from '@whiteboard/core/node'
import type {
  EdgeAnchor,
  EdgeId,
  EdgeType,
  NodeId
} from '@whiteboard/core/types'
import type { EditorRuntime } from '../../../types/internal/editor'
import {
  createInteractionSessionSlot,
  type SnapRuntime
} from '../../../runtime/interaction'
import type {
  PointerDown
} from '../../../runtime/input/pointer'
import { readEdgeType } from '../../../runtime/tool'
import type { ViewportPointer } from '../../../runtime/viewport'
import {
  DEFAULT_EDGE_ANCHOR_OFFSET,
  resolveReconnectDraftEnd,
  setEdgeConnectTarget,
  startEdgeCreate,
  startEdgeReconnect,
  toEdgeConnectCommit,
  toEdgeConnectHint,
  toEdgeConnectPatch,
  toEdgeDraftEnd,
  type EdgeConnectState
} from '../connect'
import {
  writeEdgeProjectionPatch,
  type EdgeProjection
} from '../projection'

type ConnectPointer = ViewportPointer & {
  pointerId: number
}

export type EdgeConnectInteraction = {
  startCreate: (input: PointerDown) => boolean
  startReconnect: (input: PointerDown) => boolean
  cancel: () => void
}

type EdgeConnectInteractionDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      overlay: {
        edge: Pick<EdgeProjection, 'patch' | 'hint' | 'clear'>
      }
    }
    snap: Pick<SnapRuntime, 'edge'>
  }
}

type ConnectNodeEntry = NonNullable<
  ReturnType<EdgeConnectInteractionDeps['read']['index']['node']['get']>
>

const readCaptureTarget = (
  event: Pick<PointerEvent, 'currentTarget' | 'target'>
): Element | null => (
  event.currentTarget instanceof Element
    ? event.currentTarget
    : event.target instanceof Element
      ? event.target
      : null
)

export const createEdgeConnectInteraction = (
  editor: EdgeConnectInteractionDeps
): EdgeConnectInteraction => {
  const interaction = createInteractionSessionSlot<EdgeConnectState>({
    interaction: editor.interaction,
    cleanup: () => {
      editor.internals.projections.overlay.edge.clear()
    }
  })

  const readActive = () => interaction.getActive()

  const writeActive = (
    next: EdgeConnectState | null
  ) => {
    interaction.setActive(next)
  }

  const readPointer = (
    event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...editor.viewport.pointer(event)
  })

  const clearPatch = () => {
    editor.internals.projections.overlay.edge.patch.clear()
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
    editor.internals.projections.overlay.edge.hint.set(toEdgeConnectHint(state))
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

  const updateActive = (pointer: ConnectPointer) => {
    const active = readActive()
    if (!active) {
      return false
    }

    const next = updateConnectState(active, pointer)
    if (!next) {
      return false
    }

    writeActive(next)
    writeStatePreview(next)
    return true
  }

  const startConnectSession = (
    event: PointerEvent,
    state: EdgeConnectState,
    capture?: Element | null
  ) => {
    const nextSession = interaction.start({
      mode: 'edge-connect',
      pointerId: event.pointerId,
      capture: capture ?? readCaptureTarget(event),
      pan: {
        frame: (pointer) => {
          const active = readActive()
          if (!active) {
            return
          }

          updateActive(readPointer({
            pointerId: active.pointerId,
            ...pointer
          }))
        }
      },
      move: (moveEvent, interactionSession) => {
        if (!updateActive(readPointer(moveEvent))) {
          return
        }

        interactionSession.pan(moveEvent)
      },
      up: (_upEvent, interactionSession) => {
        const active = readActive()
        if (!active) {
          return
        }

        commitConnectState(active)
        interactionSession.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    writeActive(state)
    writeStatePreview(state)

    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    startCreate: (input) => {
      if (interaction.hasActive()) {
        return false
      }

      if (input.tool.type !== 'edge') {
        return false
      }

      const edgeType = readEdgeType(input.tool.preset)
      const state = readCreateState(
        input,
        readPointer(input.event),
        edgeType
      )

      return startConnectSession(input.event, state, input.capture)
    },
    startReconnect: (input) => {
      if (interaction.hasActive()) {
        return false
      }

      if (
        input.pick.kind !== 'edge'
        || input.pick.part !== 'end'
        || !input.pick.end
      ) {
        return false
      }

      const edgeId = input.pick.id
      const end = input.pick.end
      const state = readReconnectState(edgeId, end, readPointer(input.event))
      if (!state) {
        return false
      }

      editor.commands.selection.replace({
        edgeIds: [edgeId]
      })

      return startConnectSession(input.event, state, input.capture)
    },
    cancel: () => {
      interaction.cancel()
    }
  }
}
