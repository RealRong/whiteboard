import type { Rect } from '../types/core'

export const enlargeBox = (currentBox: Rect, enlarge = 36): Rect => ({
  x: currentBox.x - enlarge,
  y: currentBox.y - enlarge,
  width: currentBox.width + 2 * enlarge,
  height: currentBox.height + 2 * enlarge
})
