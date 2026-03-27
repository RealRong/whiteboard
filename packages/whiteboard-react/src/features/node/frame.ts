import type { SpatialNodeInput } from '@whiteboard/core/types'

export const FRAME_START_SIZE = {
  width: 520,
  height: 320
} as const

export const FRAME_DEFAULT_TITLE = 'Frame'
export const FRAME_DEFAULT_FILL = 'transparent'
export const FRAME_DEFAULT_STROKE = 'hsl(var(--ui-border-strong, 40 9.1% 93.5%))'
export const FRAME_DEFAULT_TEXT_COLOR = 'hsl(var(--ui-text-secondary, 37.5 3.3% 47.5%))'
export const FRAME_DEFAULT_STROKE_WIDTH = 1

export const createFrameNodeInput = (): Omit<SpatialNodeInput, 'position'> => ({
  type: 'frame',
  size: { ...FRAME_START_SIZE },
  data: {
    title: FRAME_DEFAULT_TITLE
  },
  style: {
    fill: FRAME_DEFAULT_FILL,
    stroke: FRAME_DEFAULT_STROKE,
    strokeWidth: FRAME_DEFAULT_STROKE_WIDTH,
    color: FRAME_DEFAULT_TEXT_COLOR
  }
})
