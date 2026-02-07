import { useEffect } from 'react'
import { useInstance } from '../../common/hooks'
import { useEdgeConnect } from '../hooks'

export const useEdgeConnectRuntimeSync = () => {
  const instance = useInstance()
  const edgeConnect = useEdgeConnect()

  useEffect(() => {
    instance.services.edgeConnectRuntime.set(edgeConnect)
    return () => {
      instance.services.edgeConnectRuntime.set(null)
    }
  }, [edgeConnect, instance])
}
