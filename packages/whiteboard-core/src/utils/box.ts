import type { Node, Point, Rect } from '../types/core'

export const getBoxOfBoxes = (boxes: Rect[]): Rect | undefined => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const box of boxes) {
    if (box.width === undefined || box.height === undefined) return
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export const getBoxOfPoints = (points: Array<Point | [number, number]>): Rect => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  points.forEach((point) => {
    const x = Array.isArray(point) ? point[0] : point.x
    const y = Array.isArray(point) ? point[1] : point.y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export const getBoxOfNodes = (nodes: Node[]): Rect => {
  if (nodes.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    }
  }

  const boxes: Rect[] = nodes.map((node) => ({
    x: node.position.x,
    y: node.position.y,
    width: node.size?.width ?? 0,
    height: node.size?.height ?? 0
  }))

  return getBoxOfBoxes(boxes) ?? { x: 0, y: 0, width: 0, height: 0 }
}
