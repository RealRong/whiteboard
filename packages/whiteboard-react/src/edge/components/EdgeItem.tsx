import type { Edge, Point } from '@whiteboard/core'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { memo } from 'react'
import { useEdgeStyle } from '../hooks'

type EdgeItemProps = {
  edge: Edge
  path: { svgPath: string; points: Point[] }
  hitTestThresholdScreen: number
  selected?: boolean
  onPointerDown?: (event: PointerEvent<SVGPathElement>) => void
  onClick?: (event: MouseEvent<SVGPathElement>) => void
}

const isDashEqual = (prevDash?: number[], nextDash?: number[]) => {
  if (prevDash === nextDash) return true
  if (!prevDash || !nextDash) return !prevDash && !nextDash
  if (prevDash.length !== nextDash.length) return false
  for (let index = 0; index < prevDash.length; index += 1) {
    if (prevDash[index] !== nextDash[index]) return false
  }
  return true
}

const isEdgeStyleEqual = (prevEdge: Edge, nextEdge: Edge) => {
  const prevStyle = prevEdge.style
  const nextStyle = nextEdge.style
  if (prevStyle === nextStyle) return true
  if (!prevStyle || !nextStyle) return !prevStyle && !nextStyle
  return (
    prevStyle.stroke === nextStyle.stroke
    && prevStyle.strokeWidth === nextStyle.strokeWidth
    && prevStyle.animated === nextStyle.animated
    && prevStyle.animationSpeed === nextStyle.animationSpeed
    && prevStyle.markerStart === nextStyle.markerStart
    && prevStyle.markerEnd === nextStyle.markerEnd
    && isDashEqual(prevStyle.dash, nextStyle.dash)
  )
}

const areEdgeItemPropsEqual = (prevProps: EdgeItemProps, nextProps: EdgeItemProps) => {
  return (
    prevProps.edge.id === nextProps.edge.id
    && prevProps.selected === nextProps.selected
    && prevProps.hitTestThresholdScreen === nextProps.hitTestThresholdScreen
    && prevProps.path.svgPath === nextProps.path.svgPath
    && prevProps.onPointerDown === nextProps.onPointerDown
    && prevProps.onClick === nextProps.onClick
    && isEdgeStyleEqual(prevProps.edge, nextProps.edge)
  )
}

const EdgeItemBase = ({
  edge,
  path,
  hitTestThresholdScreen,
  selected,
  onPointerDown,
  onClick
}: EdgeItemProps) => {
  const { stroke, strokeWidth, dash, markerStart, markerEnd, hitWidth, animation } = useEdgeStyle({
    edge,
    selected,
    hitTestThresholdScreen
  })

  const hoverStrokeWidth = selected ? strokeWidth : strokeWidth + 1

  return (
    <g
      className="wb-edge-item"
      data-selected={selected ? 'true' : 'false'}
      style={{ '--wb-edge-hover-stroke-width': `${hoverStrokeWidth}` } as CSSProperties}
    >
      <path
        d={path.svgPath}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
        onPointerDown={onPointerDown}
        onClick={onClick}
        tabIndex={0}
        className="wb-edge-hit-path"
      />
      <path
        d={path.svgPath}
        fill="none"
        stroke={stroke}
        color={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        markerStart={markerStart}
        markerEnd={markerEnd}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
        className="wb-edge-visible-path"
        style={{ animation }}
      />
    </g>
  )
}

export const EdgeItem = memo(EdgeItemBase, areEdgeItemPropsEqual)

EdgeItem.displayName = 'EdgeItem'
