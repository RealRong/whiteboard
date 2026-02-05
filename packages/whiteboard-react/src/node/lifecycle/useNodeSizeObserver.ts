import { useEffect, useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { Core, Node } from '@whiteboard/core'
import { useInstance } from '../../common/hooks/useInstance'

type UseNodeSizeObserverOptions = {
  core: Core
  nodes: Node[]
  containerRef?: RefObject<HTMLElement>
  enabled?: boolean
}

export const useNodeSizeObserver = ({ core, nodes, enabled = true }: UseNodeSizeObserverOptions) => {
  const instance = useInstance({ required: false })

  useLayoutEffect(() => {
    if (!instance) return
    if (instance.core !== core) return
    instance.services.nodeSizeObserver.sync(nodes, enabled)
  }, [core, enabled, instance, nodes])

  useEffect(() => {
    return () => {
      if (!instance) return
      if (instance.core !== core) return
      instance.services.nodeSizeObserver.dispose()
    }
  }, [core, instance])
}
