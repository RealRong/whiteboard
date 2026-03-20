import type { DrawPresetKey } from '../tool'
import type { DrawRead as RuntimeDrawRead, DrawStyle } from '../draw'

export type DrawRead = {
  style: (preset?: DrawPresetKey) => DrawStyle
}

export const createDrawRead = ({
  draw
}: {
  draw: RuntimeDrawRead
}): DrawRead => ({
  style: (preset) => draw.style(preset)
})
