import type { CSSProperties } from 'react'
import type { NodeToolbarPlacement } from './model'

type ToolbarMenuAnchor = {
  top: number
  bottom: number
  centerX: number
}

const SAFE_MARGIN = 12
const MENU_WIDTH = 220

const resolveHorizontalPosition = (
  centerX: number,
  containerWidth: number,
  estimatedWidth: number
) => {
  if (centerX <= estimatedWidth / 2 + SAFE_MARGIN) {
    return {
      left: SAFE_MARGIN,
      transform: ''
    }
  }
  if (centerX >= containerWidth - estimatedWidth / 2 - SAFE_MARGIN) {
    return {
      left: containerWidth - SAFE_MARGIN,
      transform: 'translateX(-100%)'
    }
  }
  return {
    left: centerX,
    transform: 'translateX(-50%)'
  }
}

export const buildToolbarStyle = ({
  placement,
  x,
  y,
  containerWidth,
  itemCount
}: {
  placement: NodeToolbarPlacement
  x: number
  y: number
  containerWidth: number
  itemCount: number
}): CSSProperties => {
  const widthEstimate = Math.max(160, itemCount * 36 + 28)
  const horizontal = resolveHorizontalPosition(x, containerWidth, widthEstimate)
  return {
    left: horizontal.left,
    top: y,
    transform: [horizontal.transform, placement === 'top' ? 'translateY(-100%)' : 'translateY(0)']
      .filter(Boolean)
      .join(' ')
  }
}

export const buildToolbarMenuStyle = ({
  anchor,
  containerWidth,
  containerHeight
}: {
  anchor: ToolbarMenuAnchor
  containerWidth: number
  containerHeight: number
}): CSSProperties => {
  const horizontal = resolveHorizontalPosition(anchor.centerX, containerWidth, MENU_WIDTH)
  const placeBottom = containerHeight - anchor.bottom >= 240
  return {
    left: horizontal.left,
    top: placeBottom ? anchor.bottom + 8 : anchor.top - 8,
    transform: [horizontal.transform, placeBottom ? 'translateY(0)' : 'translateY(-100%)']
      .filter(Boolean)
      .join(' ')
  }
}
