import {
  resolveAnchorFromPoint,
} from '@whiteboard/core/edge'
import { getNodeAnchorPoint } from '@whiteboard/core/node'
import type {
  EdgeAnchor,
  EdgeId,
  EdgeType,
  NodeId
} from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef
} from 'react'
import { useInternalInstance, useTool } from '../../../runtime/hooks'
import type {
  EdgeCreateDown,
  EdgeDown
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
  writeEdgePreviewPatch
} from '../preview'
import {
  type PointerSourceEvent,
  readCaptureTarget
} from './useEdgePatchSession'

type ConnectPointer = ViewportPointer & {
  pointerId: number
}

type ConnectNodeEntry = NonNullable<
  ReturnType<ReturnType<typeof useInternalInstance>['read']['index']['node']['get']>
>

export const useEdgeConnectInput = () => {
  const instance = useInternalInstance()
  const tool = useTool()
  const activeRef = useRef<EdgeConnectState | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const readPointer = useCallback((
    event: Pick<PointerSourceEvent, 'pointerId' | 'clientX' | 'clientY'>
  ): ConnectPointer => ({
    pointerId: event.pointerId,
    ...instance.viewport.pointer(event)
  }), [instance])

  const clearPatch = useCallback(() => {
    instance.internals.edge.preview.patch.clear()
  }, [instance])

  const readConnectNode = useCallback((
    nodeId: NodeId
  ): ConnectNodeEntry | undefined => {
    const entry = instance.read.index.node.get(nodeId)
    if (!entry || !instance.read.node.connect(entry.node)) {
      return undefined
    }

    return entry
  }, [instance])

  const readCreateState = useCallback((
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
  }, [instance, readConnectNode])

  const readReconnectState = useCallback((
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
  }, [instance])

  const updateConnectState = useCallback((
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
  }, [instance])

  const commitConnectState = useCallback((state: EdgeConnectState) => {
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
  }, [instance])

  const writeStateHint = useCallback((state: EdgeConnectState) => {
    instance.internals.edge.preview.hint.set(toEdgeConnectHint(state))
  }, [instance])

  const writeStatePatch = useCallback((state: EdgeConnectState) => {
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
  }, [clearPatch, instance])

  const writeStatePreview = useCallback((state: EdgeConnectState) => {
    writeStateHint(state)
    writeStatePatch(state)
  }, [writeStateHint, writeStatePatch])

  const updateActive = useCallback((pointer: ConnectPointer) => {
    const active = activeRef.current
    if (!active) {
      return false
    }

    const next = updateConnectState(active, pointer)
    if (!next) {
      return false
    }

    activeRef.current = next
    writeStatePreview(next)
    return true
  }, [updateConnectState, writeStatePreview])

  const clearConnect = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.edge.preview.clear()
  }, [instance])

  const cancelConnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clearConnect()
  }, [clearConnect])

  const startConnectSession = useCallback((
    event: PointerSourceEvent,
    state: EdgeConnectState,
    capture?: Element | null
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'edge-connect',
      pointerId: event.pointerId,
      capture: capture ?? readCaptureTarget(event),
      pan: {
        frame: (pointer) => {
          const active = activeRef.current
          if (!active) {
            return
          }

          updateActive(readPointer({
            pointerId: active.pointerId,
            ...pointer
          }))
        }
      },
      cleanup: clearConnect,
      move: (moveEvent, session) => {
        if (!updateActive(readPointer(moveEvent))) {
          return
        }

        session.pan(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        commitConnectState(active)
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    activeRef.current = state
    sessionRef.current = nextSession
    writeStatePreview(state)

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clearConnect, commitConnectState, readPointer, updateActive, writeStatePreview])

  const create = useCallback((
    input: EdgeCreateDown
  ) => {
    if (activeRef.current) {
      return false
    }

    const edgeType = readEdgeType(input.tool.preset)
    if (!edgeType) {
      return false
    }

    const state = readCreateState(
      input,
      readPointer(input.event),
      edgeType
    )

    return startConnectSession(input.event, state, input.capture)
  }, [
    readCreateState,
    readPointer,
    startConnectSession
  ])

  useEffect(() => {
    if (tool.type !== 'edge' && activeRef.current?.kind === 'create') {
      cancelConnect()
    }
  }, [cancelConnect, tool])

  useEffect(() => () => {
    cancelConnect()
  }, [cancelConnect])

  return {
    create,
    reconnect: (
      input: EdgeDown
    ) => {
      if (activeRef.current) {
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
    }
  }
}
