import { useEdgeConnectLifecycle } from './useEdgeConnectLifecycle'
import { useEdgeConnectRuntimeSync } from './useEdgeConnectRuntimeSync'

export const useEdgeLifecycle = () => {
  useEdgeConnectLifecycle()
  useEdgeConnectRuntimeSync()
}
