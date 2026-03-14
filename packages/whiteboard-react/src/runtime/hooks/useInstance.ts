import { createContext, useContext } from 'react'
import type { InternalWhiteboardInstance, WhiteboardInstance } from '../instance/types'

const InstanceContext = createContext<InternalWhiteboardInstance | null>(null)

export const InstanceProvider = InstanceContext.Provider

export const useInternalInstance = () => {
  const instance = useContext(InstanceContext)
  if (!instance) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}

export const useInstance = (): WhiteboardInstance => useInternalInstance()
