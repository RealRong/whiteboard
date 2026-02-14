import { useEffect } from 'react'
import type { WhiteboardInstance, WhiteboardLifecycleConfig } from '@whiteboard/engine'

type Options = {
  instance: WhiteboardInstance
  config: WhiteboardLifecycleConfig
}

export const useWhiteboardLifecycle = ({ instance, config }: Options) => {
  const lifecycle = instance.runtime.lifecycle

  useEffect(() => {
    lifecycle.start()
    return () => {
      lifecycle.stop()
    }
  }, [lifecycle])

  useEffect(() => {
    lifecycle.update(config)
  }, [config, lifecycle])
}
