import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent, PointerEvent } from 'react'
import { useEdgeStyle } from '../hooks'

type EdgeItemProps = {
  edge: Edge
  path: { svgPath: string; points: Point[] }
  hitTestThresholdScreen: number
  selected?: boolean
  hovered?: boolean
  onPointerDown?: (event: PointerEvent<SVGPathElement>) => void
  onClick?: (event: MouseEvent<SVGPathElement>) => void
  onHoverChange?: (hovered: boolean) => void
}

export const EdgeItem = ({
  edge,
  path,
  hitTestThresholdScreen,
  selected,
  hovered,
  onPointerDown,
  onClick,
  onHoverChange
}: EdgeItemProps) => {
  const { stroke, strokeWidth, dash, markerStart, markerEnd, hitWidth, animation } = useEdgeStyle({
    edge,
    selected,
    hovered,
    hitTestThresholdScreen
  })

  return (
    <g>
      <path
        d={path.svgPath}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        pointerEvents="stroke"
        onPointerDown={onPointerDown}
        onClick={onClick}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
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
        style={{
          color: stroke,
          animation
        }}
      />
    </g>
  )
}
