import { useEffect } from 'react'
import { useInstance } from '../hooks/useInstance'

export const useTransientLifecycle = () => {
  const instance = useInstance()

  useEffect(() => {
    return () => {
      instance.api.transient.reset()
    }
  }, [instance])
}
