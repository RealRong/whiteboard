import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../common/hooks'
import { EdgeLayer } from './EdgeLayer'

const readPointerWorld = (
  instance: ReturnType<typeof useInstance>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

export const EdgeSceneLayer = () => {
  const instance = useInstance()

  const handleEdgePathPointerDown = useCallback((
    event: ReactPointerEvent<SVGPathElement>,
  ) => {
    if (event.button !== 0) return

    const edgeId = event.currentTarget.closest('[data-edge-id]')?.getAttribute('data-edge-id') as EdgeId | null
    if (!edgeId) return

    const entry = instance.read.edge.get(edgeId)
    if (!entry) return

    if (!instance.read.container.hasEdge(entry.edge)) {
      instance.commands.selection.clear()
      instance.commands.container.exit()
    }

    if (event.shiftKey || event.detail >= 2) {
      instance.commands.edge.routing.insertAtPoint(edgeId, readPointerWorld(instance, event))
    }

    instance.commands.selection.selectEdge(edgeId)
    event.preventDefault()
    event.stopPropagation()
  }, [instance])

  return (
    <EdgeLayer handleEdgePathPointerDown={handleEdgePathPointerDown} />
  )
}
