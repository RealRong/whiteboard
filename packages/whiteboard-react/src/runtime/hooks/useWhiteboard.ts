import { createContext, useContext } from 'react'
import type { EditTarget } from '../edit'
import type { FrameScope } from '../frame'
import type { WhiteboardInstance, InternalInstance } from '../instance/types'
import type { InteractionState } from '../interaction'
import type { Tool } from '../tool'
import { useStoreValue } from './useStoreValue'

const InstanceContext = createContext<InternalInstance | null>(null)

export const InstanceProvider = InstanceContext.Provider

export const useInternalInstance = () => {
  const instance = useContext(InstanceContext)
  if (!instance) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}

export const useWhiteboard = (): WhiteboardInstance => useInternalInstance()

export const useEdit = (): EditTarget => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.edit)
}

export const useTool = (): Tool => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.tool)
}

export const useFrameScope = (): FrameScope => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.frame)
}

export const useInteraction = (): InteractionState => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.interaction)
}
