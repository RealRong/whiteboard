export type PackBox = {
  id: string | number
  width: number
  height: number
  x?: number
  y?: number
}

export default function packBoxes(boxes: PackBox[]) {
  let area = 0
  let maxWidth = 0

  for (const box of boxes) {
    area += box.width * box.height
    maxWidth = Math.max(maxWidth, box.width)
  }

  boxes.sort((a, b) => b.height - a.height)

  const startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth)

  const spaces = [{ x: 0, y: 0, w: startWidth, h: Infinity }]

  let width = 0
  let height = 0

  for (const box of boxes) {
    for (let i = spaces.length - 1; i >= 0; i -= 1) {
      const space = spaces[i]

      if (box.width > space.w || box.height > space.h) continue

      box.x = space.x
      box.y = space.y

      height = Math.max(height, box.y + box.height)
      width = Math.max(width, box.x + box.width)

      if (box.width === space.w && box.height === space.h) {
        const last = spaces.pop()
        if (last && i < spaces.length) spaces[i] = last
      } else if (box.height === space.h) {
        space.x += box.width
        space.w -= box.width
      } else if (box.width === space.w) {
        space.y += box.height
        space.h -= box.height
      } else {
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
    width,
    height,
    fill: area / (width * height) || 0
  }
}
