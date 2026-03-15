import type { InteractionView } from '../view/interaction'
import { useInternalInstance } from './useInstance'
import { useView } from './useView'

export const useInteraction = (): InteractionView => {
  const instance = useInternalInstance()
  return useView(instance.view.interaction)
}
