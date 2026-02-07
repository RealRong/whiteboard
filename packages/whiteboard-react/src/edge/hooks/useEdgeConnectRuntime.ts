import { useInstance } from '../../common/hooks'

export const useEdgeConnectRuntime = () => {
  const instance = useInstance()
  return instance.services.edgeConnectRuntime.get()
}
