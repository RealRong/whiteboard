import type { Node, Rect, Size } from '../types'
import { getAABBFromPoints } from './rect'
import { getRotatedCorners } from './rotation'

const ORIGIN = {
  x: 0,
  y: 0
} as const

export const getNodeRect = (node: Node, fallback: Size): Rect => {
  const width = node.size?.width ?? fallback.width
  const height = node.size?.height ?? fallback.height
  const position = node.position ?? ORIGIN

  return {
    x: position.x,
    y: position.y,
    width,
    height
  }
}

export const getNodeAABB = (node: Node, fallback: Size): Rect => {
  const rect = getNodeRect(node, fallback)
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  if (!rotation) return rect
  const corners = getRotatedCorners(rect, rotation)
  return getAABBFromPoints(corners)
}
