import { createContext, useContext } from 'react'
import type { Instance } from '@whiteboard/engine'

const InstanceContext = createContext<Instance | null>(null)

export const InstanceProvider = InstanceContext.Provider

export const useInstance = () => {
  const instance = useContext(InstanceContext)
  if (!instance) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}
