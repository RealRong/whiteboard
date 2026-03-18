import { createContext, useContext } from 'react'
import type { WhiteboardInstance, InternalInstance } from '../instance/types'

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
