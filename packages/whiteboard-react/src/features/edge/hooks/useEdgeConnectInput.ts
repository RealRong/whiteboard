import {
  useEffect,
  useRef
} from 'react'
import { createEdgeConnectSession } from '@whiteboard/editor'
import { useInternalInstance, useTool } from '../../../runtime/hooks'

export const useEdgeConnectInput = () => {
  const instance = useInternalInstance()
  const tool = useTool()
  const sessionRef = useRef<ReturnType<typeof createEdgeConnectSession> | null>(null)
  const session =
    sessionRef.current
    ?? (sessionRef.current = createEdgeConnectSession(instance))

  useEffect(() => {
    if (tool.type !== 'edge') {
      session.cancel()
    }
  }, [session, tool.type])

  useEffect(() => () => {
    session.cancel()
  }, [session])

  return {
    create: session.create,
    reconnect: session.reconnect
  }
}
