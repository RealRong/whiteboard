import { useEffect } from 'react'
import { useInstance } from '../../common/hooks'
import type { UseEdgeConnectReturn } from '../hooks/useEdgeConnect'

export const useEdgeConnectRuntimeSync = (edgeConnect: UseEdgeConnectReturn) => {
  const instance = useInstance()

  useEffect(() => {
    instance.services.edgeConnectRuntime.set(edgeConnect)
    return () => {
      instance.services.edgeConnectRuntime.set(null)
    }
  }, [edgeConnect, instance])
}
