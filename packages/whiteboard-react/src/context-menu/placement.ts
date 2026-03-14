import type { Point } from '@whiteboard/core/types'

const MENU_WIDTH = 220
const MENU_SAFE_MARGIN = 12

export const resolveContextMenuPlacement = ({
  screen,
  containerWidth,
  containerHeight
}: {
  screen: Point
  containerWidth: number
  containerHeight: number
}) => {
  const clampedLeft = Math.min(
    Math.max(MENU_SAFE_MARGIN, screen.x),
    Math.max(MENU_SAFE_MARGIN, containerWidth - MENU_SAFE_MARGIN)
  )
  const clampedTop = Math.min(
    Math.max(MENU_SAFE_MARGIN, screen.y),
    Math.max(MENU_SAFE_MARGIN, containerHeight - MENU_SAFE_MARGIN)
  )

  const alignRight = clampedLeft + MENU_WIDTH > containerWidth - MENU_SAFE_MARGIN
  const alignBottom = clampedTop + 280 > containerHeight - MENU_SAFE_MARGIN

  return {
    left: clampedLeft,
    top: clampedTop,
    transform: `${alignRight ? 'translateX(-100%)' : ''} ${alignBottom ? 'translateY(-100%)' : ''}`.trim()
  }
}
