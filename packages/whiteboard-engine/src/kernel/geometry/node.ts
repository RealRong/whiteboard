import type { Node, Rect } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import { getAABBFromPoints } from './rect'
import { getRotatedCorners } from './rotation'

export const getNodeRect = (node: Node, fallback: Size): Rect => {
  const width = node.size?.width ?? fallback.width
  const height = node.size?.height ?? fallback.height

  return {
    x: node.position.x,
    y: node.position.y,
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
