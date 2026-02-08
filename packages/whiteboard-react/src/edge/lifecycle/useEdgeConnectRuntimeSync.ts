import { useEffect, useMemo, useRef } from 'react'
import type { UseEdgeConnectReturn } from '../hooks'
import { useInstance } from '../../common/hooks'
import { useEdgeConnectActions, useEdgeConnectState } from '../hooks'

export const useEdgeConnectRuntimeSync = () => {
  const instance = useInstance()
  const edgeConnectState = useEdgeConnectState()
  const edgeConnectActions = useEdgeConnectActions()

  const stateRef = useRef(edgeConnectState)
  const actionsRef = useRef(edgeConnectActions)

  useEffect(() => {
    stateRef.current = edgeConnectState
  }, [edgeConnectState])

  useEffect(() => {
    actionsRef.current = edgeConnectActions
  }, [edgeConnectActions])

  const edgeConnect = useMemo<UseEdgeConnectReturn>(() => {
    return {
      get state() {
        return stateRef.current.state
      },
      get selectedEdgeId() {
        return stateRef.current.selectedEdgeId
      },
      get tool() {
        return stateRef.current.tool
      },
      get containerRef() {
        return stateRef.current.containerRef
      },
      get screenToWorld() {
        return stateRef.current.screenToWorld
      },
      get nodeRects() {
        return stateRef.current.nodeRects
      },
      getAnchorFromPoint: (...args) => stateRef.current.getAnchorFromPoint(...args),
      startFromHandle: (...args) => actionsRef.current.startFromHandle(...args),
      startFromPoint: (...args) => actionsRef.current.startFromPoint(...args),
      startReconnect: (...args) => actionsRef.current.startReconnect(...args),
      updateTo: (...args) => actionsRef.current.updateTo(...args),
      commitTo: (...args) => actionsRef.current.commitTo(...args),
      cancel: () => actionsRef.current.cancel(),
      selectEdge: (...args) => actionsRef.current.selectEdge(...args),
      updateHover: (...args) => actionsRef.current.updateHover(...args),
      handleNodePointerDown: (...args) => actionsRef.current.handleNodePointerDown(...args)
    }
  }, [])

  useEffect(() => {
    instance.services.edgeConnectRuntime.set(edgeConnect)
    return () => {
      instance.services.edgeConnectRuntime.set(null)
    }
  }, [edgeConnect, instance])
}
