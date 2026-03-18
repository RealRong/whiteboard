import type { InteractionMode } from '../interaction'
import { useWhiteboard } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useInteraction = (): InteractionMode => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.interaction)
}
