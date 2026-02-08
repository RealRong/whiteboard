import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent, PointerEvent } from 'react'
import { useEdgeStyle } from '../hooks'

type EdgeItemProps = {
  edge: Edge
  path: { svgPath: string; points: Point[] }
  hitTestThresholdScreen: number
  selected?: boolean
  onPointerDown?: (event: PointerEvent<SVGPathElement>) => void
  onClick?: (event: MouseEvent<SVGPathElement>) => void
}

export const EdgeItem = ({
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
    <g className="wb-edge-item" data-selected={selected ? 'true' : undefined}>
      <path
        d={path.svgPath}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        pointerEvents="stroke"
        onPointerDown={onPointerDown}
        onClick={onClick}
        tabIndex={0}
        className="wb-edge-hit-path"
        style={{
          vectorEffect: 'non-scaling-stroke'
        }}
      />
      <path
        d={path.svgPath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        markerStart={markerStart}
        markerEnd={markerEnd}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
        className="wb-edge-visible-path"
        style={{
          color: stroke,
          animation
        }}
      />
      <path
        d={path.svgPath}
        fill="none"
        stroke={stroke}
        strokeWidth={hoverStrokeWidth}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
        className="wb-edge-hover-path"
      />
    </g>
  )
}
