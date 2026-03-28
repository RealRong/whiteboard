import {
  useEffect,
  useRef
} from 'react'
import { useInternalInstance, useTool } from '../../../runtime/hooks'

export const useEdgeConnectInput = () => {
  const instance = useInternalInstance()
  const tool = useTool()
  const sessionRef = useRef(instance.internals.edge.connect)
  const session = sessionRef.current

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
