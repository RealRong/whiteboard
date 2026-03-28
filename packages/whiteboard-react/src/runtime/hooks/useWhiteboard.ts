import { createContext, useContext } from 'react'
import type { Editor } from '../instance'
import { useStoreValue } from './useStoreValue'

type EditTarget = ReturnType<Editor['state']['edit']['get']>
type Tool = ReturnType<Editor['state']['tool']['get']>
type FrameScope = ReturnType<Editor['state']['frame']['get']>
type InteractionState = ReturnType<Editor['state']['interaction']['get']>

const InstanceContext = createContext<Editor | null>(null)

export const InstanceProvider = InstanceContext.Provider

export const useInternalInstance = () => {
  const instance = useContext(InstanceContext)
  if (!instance) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}

export const useWhiteboard = (): Editor => useInternalInstance()

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
  return useStoreValue(instance.read.frame.scope)
}

export const useInteraction = (): InteractionState => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.interaction)
}
