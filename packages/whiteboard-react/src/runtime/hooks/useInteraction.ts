import type { InteractionMode } from '../interaction'
import { useInternalInstance } from './useInstance'
import { useView } from './useView'

export const useInteraction = (): InteractionMode => {
  const instance = useInternalInstance()
  return useView(instance.interaction.mode)
}
