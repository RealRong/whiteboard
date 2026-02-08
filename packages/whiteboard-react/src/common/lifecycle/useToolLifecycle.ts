import { useEffect } from 'react'
import { useInstance } from '../hooks/useInstance'

export const useToolLifecycle = (tool: string) => {
  const instance = useInstance()

  useEffect(() => {
    instance.commands.tool.set(tool)
  }, [instance, tool])
}
