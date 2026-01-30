import { Box } from '~/typings'

export default function packBoxes(boxes: { id: number; width: number; height: number }[]) {
  // calculate total box area and maximum box width
  let area = 0
  let maxWidth = 0

  for (const box of boxes) {
    area += box.width * box.height
    maxWidth = Math.max(maxWidth, box.width)
  }

  // sort the boxes for insertion by height, descending
  boxes.sort((a, b) => b.height - a.height)

  // aim for a squarish resulting container,
  // slightly adjusted for sub-100% space utilization
  const startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth)

  // start with a single empty space, unbounded at the bottom
  const spaces = [{ x: 0, y: 0, w: startWidth, h: Infinity }]

  let width = 0
  let height = 0

  for (const box of boxes) {
    // look through spaces backwards so that we check smaller spaces first
    for (let i = spaces.length - 1; i >= 0; i--) {
      const space = spaces[i]

      // look for empty spaces that can accommodate the current box
      if (box.width > space.w || box.height > space.h) continue

      // found the space; add the box to its top-left corner
      // |-------|-------|
      // |  box  |       |
      // |_______|       |
      // |         space |
      // |_______________|
      box.left = space.x
      box.top = space.y

      height = Math.max(height, box.top + box.height)
      width = Math.max(width, box.left + box.width)

      if (box.width === space.w && box.height === space.h) {
        // space matches the box exactly; remove it
        const last = spaces.pop()
        if (i < spaces.length) spaces[i] = last
      } else if (box.height === space.h) {
        // space matches the box height; update it accordingly
        // |-------|---------------|
        // |  box  | updated space |
        // |_______|_______________|
        space.x += box.width
        space.w -= box.width
      } else if (box.width === space.w) {
        // space matches the box width; update it accordingly
        // |---------------|
        // |      box      |
        // |_______________|
        // | updated space |
        // |_______________|
        space.y += box.height
        space.h -= box.height
      } else {
        // otherwise the box splits the space into two spaces
        // |-------|-----------|
        // |  box  | new space |
        // |_______|___________|
        // | updated space     |
        // |___________________|
        spaces.push({
          x: space.x + box.width,
          y: space.y,
          w: space.w - box.width,
          h: box.height
        })
        space.y += box.height
        space.h -= box.height
      }
      break
    }
  }

  return {
    width, // container width
    height, // container height
    fill: area / (width * height) || 0 // space utilization
  }
}
