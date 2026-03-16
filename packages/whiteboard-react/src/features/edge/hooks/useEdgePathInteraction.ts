import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeId } from '@whiteboard/core/types'
import { useCallback } from 'react'
import { useInternalInstance as useInstance } from '../../../runtime/hooks'
import { hasContainerEdge } from '../../../runtime/state'

export const useEdgePathInteraction = () => {
  const instance = useInstance()

  return useCallback((event: ReactPointerEvent<SVGPathElement>) => {
    if (event.button !== 0) {
      return
    }

    const edgeId = event.currentTarget
      .closest('[data-edge-id]')
      ?.getAttribute('data-edge-id') as EdgeId | null
    if (!edgeId) {
      return
    }

    const entry = instance.read.edge.item.get(edgeId)
    if (!entry) {
      return
    }

    if (!hasContainerEdge(instance.state.container.get(), entry.edge)) {
      instance.commands.selection.clear()
      instance.commands.container.exit()
    }

    if (event.shiftKey || event.detail >= 2) {
      const point = instance.viewport.pointer(event).world
      instance.commands.edge.routing.insertAtPoint(edgeId, point)
    }

    instance.commands.selection.selectEdge(edgeId)
    event.preventDefault()
    event.stopPropagation()
  }, [instance])
}
