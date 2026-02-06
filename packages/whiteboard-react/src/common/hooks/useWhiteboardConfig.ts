import { useInstance } from './useInstance'

export const useWhiteboardConfig = () => {
  const instance = useInstance()
  return instance.config
}
