import type { InteractionMode } from '../interaction'
import { useInternalInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useInteraction = (): InteractionMode => {
  const instance = useInternalInstance()
  return useStoreValue(instance.interaction.mode)
}
