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
import type { EditorRuntime } from '../../runtime/editor/types'
import type {
  InteractionStart
} from '../../runtime/input/pointer'
import {
  isEdgeCreateInteractionStart,
  isEdgeInteractionStart
} from './interactionStart'
import { readEdgeType } from '../../runtime/tool'
import type { ViewportPointer } from '../../runtime/viewport'
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
} from './connect'
import {
  writeEdgePreviewPatch
} from './preview'

type ConnectPointer = ViewportPointer & {
  pointerId: number
}

export type EdgeConnectSession = {
  create: (input: InteractionStart) => boolean
  reconnect: (input: InteractionStart) => boolean
  cancel: () => void
}

type EdgeConnectSessionDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: Pick<EditorRuntime['internals'], 'edge' | 'snap'>
}

type ConnectNodeEntry = NonNullable<
  ReturnType<EdgeConnectSessionDeps['read']['index']['node']['get']>
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

export const createEdgeConnectSession = (
  editor: EdgeConnectSessionDeps
): EdgeConnectSession => {
  let active: EdgeConnectState | null = null
  let session: ReturnType<typeof editor.interaction.start> = null

  const readPointer = (
    event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...editor.viewport.pointer(event)
  })

  const clearPatch = () => {
    editor.internals.edge.preview.patch.clear()
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
    input: InteractionStart,
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
    editor.internals.edge.preview.hint.set(toEdgeConnectHint(state))
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

    writeEdgePreviewPatch(
      editor.internals.edge.preview,
      state.edgeId,
      patch
    )
  }

  const writeStatePreview = (state: EdgeConnectState) => {
    writeStateHint(state)
    writeStatePatch(state)
  }

  const updateActive = (pointer: ConnectPointer) => {
    if (!active) {
      return false
    }

    const next = updateConnectState(active, pointer)
    if (!next) {
      return false
    }

    active = next
    writeStatePreview(next)
    return true
  }

  const clear = () => {
    active = null
    session = null
    editor.internals.edge.preview.clear()
  }

  const startConnectSession = (
    event: PointerEvent,
    state: EdgeConnectState,
    capture?: Element | null
  ) => {
    const nextSession = editor.interaction.start({
      mode: 'edge-connect',
      pointerId: event.pointerId,
      capture: capture ?? readCaptureTarget(event),
      pan: {
        frame: (pointer) => {
          if (!active) {
            return
          }

          updateActive(readPointer({
            pointerId: active.pointerId,
            ...pointer
          }))
        }
      },
      cleanup: clear,
      move: (moveEvent, interactionSession) => {
        if (!updateActive(readPointer(moveEvent))) {
          return
        }

        interactionSession.pan(moveEvent)
      },
      up: (_upEvent, interactionSession) => {
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

    active = state
    session = nextSession
    writeStatePreview(state)

    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    create: (input) => {
      if (active) {
        return false
      }

      if (!isEdgeCreateInteractionStart(input)) {
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
    reconnect: (input) => {
      if (active) {
        return false
      }

      if (!isEdgeInteractionStart(input)) {
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
      if (session) {
        session.cancel()
        return
      }

      clear()
    }
  }
}
