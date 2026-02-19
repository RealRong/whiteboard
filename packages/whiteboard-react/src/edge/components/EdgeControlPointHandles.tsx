import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { useEdgeSelectedRoutingView, useInstance, useWhiteboardSelector } from '../../common/hooks'
import { toPointerInput } from '../../common/pointerInput'

export const EdgeControlPointHandles = () => {
  const instance = useInstance()
  const selectedRouting = useEdgeSelectedRoutingView()
  const routingDrag = useWhiteboardSelector('routingDrag')
  const edge = selectedRouting?.edge
  const points = selectedRouting?.points ?? []
  const activeDrag = routingDrag.active
  const activeIndex = edge && activeDrag && activeDrag.edgeId === edge.id ? activeDrag.index : null

  if (!edge || points.length === 0 || edge.type === 'bezier' || edge.type === 'curve') return null

  const removePointAt = (index: number) => {
    instance.commands.edge.removeRoutingPoint(edge, index)
  }

  const handlePointerDown = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    const handled = instance.runtime.interaction.routingDrag.start({
      edgeId: edge.id,
      index,
      pointer: toPointerInput(instance, event)
    })
    if (!handled) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
  }

  const handleDoubleClick = (index: number) => (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    removePointAt(index)
  }

  return (
    <div className="wb-edge-control-point-layer">
      {points.map((point, index) => (
        <div
          key={`${edge.id}-point-${index}`}
          data-selection-ignore
          className="wb-edge-control-point-handle"
          data-active={index === activeIndex ? 'true' : undefined}
          onPointerDown={handlePointerDown(index)}
          onDoubleClick={handleDoubleClick(index)}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              instance.runtime.interaction.routingDrag.cancel()
              return
            }
            if (event.key !== 'Backspace' && event.key !== 'Delete') return
            event.preventDefault()
            event.stopPropagation()
            const nextPointCount = points.length - 1
            removePointAt(index)
            if (nextPointCount <= 0) {
              instance.runtime.interaction.routingDrag.cancel()
            }
          }}
          style={{
            '--wb-edge-control-point-x': point.x,
            '--wb-edge-control-point-y': point.y,
            '--wb-edge-control-point-scale': index === activeIndex ? 1.08 : 1
          } as CSSProperties}
          tabIndex={0}
        />
      ))}
    </div>
  )
}
