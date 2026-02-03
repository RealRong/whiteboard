import { useMemo } from 'react'
import type { Edge } from '@whiteboard/core'
import { EDGE_ARROW_END_ID, EDGE_ARROW_START_ID, EDGE_DASH_ANIMATION } from '../constants'

type Options = {
  edge: Edge
  selected?: boolean
  hovered?: boolean
  hitTestThresholdScreen?: number
}

const resolveMarker = (value: string | undefined, fallbackId: string) => {
  if (!value) return undefined
  if (value.startsWith('url(')) return value
  if (value === 'arrow') return `url(#${fallbackId})`
  return `url(#${value})`
}

export const useEdgeStyle = ({ edge, selected, hovered, hitTestThresholdScreen = 10 }: Options) => {
  return useMemo(() => {
    const baseStroke = edge.style?.stroke ?? '#2f2f33'
    const stroke = selected ? '#2563eb' : baseStroke
    const baseWidth = edge.style?.strokeWidth ?? 2
    const strokeWidth = selected ? Math.max(baseWidth, 3) : hovered ? baseWidth + 1 : baseWidth
    const isAnimated = Boolean(edge.style?.animated)
    const dashArray = edge.style?.dash ?? (isAnimated ? [6, 4] : undefined)
    const dash = dashArray?.join(' ')
    const animationDuration = Math.max(0.3, edge.style?.animationSpeed ?? 1.2)
    const markerStart = resolveMarker(edge.style?.markerStart, EDGE_ARROW_START_ID)
    const markerEnd = resolveMarker(edge.style?.markerEnd, EDGE_ARROW_END_ID)
    const hitWidth = Math.max(6, strokeWidth + hitTestThresholdScreen)
    const animation = isAnimated ? `${EDGE_DASH_ANIMATION} ${animationDuration}s linear infinite` : undefined

    return {
      stroke,
      strokeWidth,
      dash,
      markerStart,
      markerEnd,
      hitWidth,
      animation
    }
  }, [edge, hitTestThresholdScreen, hovered, selected])
}
