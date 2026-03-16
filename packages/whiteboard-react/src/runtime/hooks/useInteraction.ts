import type { InteractionMode } from '../interaction'
import { useInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useInteraction = (): InteractionMode => {
  const instance = useInstance()
  return useStoreValue(instance.state.interaction)
}
