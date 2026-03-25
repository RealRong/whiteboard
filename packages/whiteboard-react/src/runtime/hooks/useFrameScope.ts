import type { FrameScope } from '../frame'
import { useWhiteboard } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useFrameScope = (): FrameScope => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.frame)
}
