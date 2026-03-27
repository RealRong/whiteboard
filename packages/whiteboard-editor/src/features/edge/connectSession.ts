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
import type { InternalInstance } from '../../runtime/instance'
import type {
  EdgeCreateDown,
  EdgeDown
} from '../../runtime/input/pointer'
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

type ConnectNodeEntry = NonNullable<
  ReturnType<InternalInstance['read']['index']['node']['get']>
>

export type EdgeConnectSession = {
  create: (input: EdgeCreateDown) => boolean
  reconnect: (input: EdgeDown) => boolean
  cancel: () => void
}

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
  instance: InternalInstance
): EdgeConnectSession => {
  let active: EdgeConnectState | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readPointer = (
    event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...instance.viewport.pointer(event)
  })

  const clearPatch = () => {
    instance.internals.edge.preview.patch.clear()
  }

  const readConnectNode = (
    nodeId: NodeId
  ): ConnectNodeEntry | undefined => {
    const entry = instance.read.index.node.get(nodeId)
    if (!entry || !instance.read.node.connect(entry.node)) {
      return undefined
    }

    return entry
  }

  const readCreateState = (
    input: EdgeCreateDown,
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
          zoom: instance.viewport.get().zoom,
          config: instance.config.edge
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
    const view = instance.read.edge.view.get(edgeId)
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

    const snap = instance.internals.snap.edge.connect(pointer.world)
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
      instance.commands.edge.reconnect(
        commit.edgeId,
        commit.end,
        commit.target
      )
      return
    }

    instance.commands.edge.create(commit.input)
  }

  const writeStateHint = (state: EdgeConnectState) => {
    instance.internals.edge.preview.hint.set(toEdgeConnectHint(state))
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
      instance.internals.edge.preview,
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
    instance.internals.edge.preview.clear()
  }

  const startConnectSession = (
    event: PointerEvent,
    state: EdgeConnectState,
    capture?: Element | null
  ) => {
    const nextSession = instance.interaction.start({
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

      instance.commands.selection.replace({
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
