import type { Node } from '../types/core'
import { getBoxOfNodes } from './box'

const hasBounds = (node: Node) => node.size?.width !== undefined && node.size?.height !== undefined

const cloneWithPosition = (node: Node, x: number, y: number): Node => ({
  ...node,
  position: {
    x,
    y
  }
})

export const horizontalSpacing = (nodes: Node[], spacing = 15): Node[] => {
  const bounded = nodes.filter(hasBounds)
  if (bounded.length === 0) return []
  const sorted = bounded.map((node) => ({ ...node, position: { ...node.position } }))
  sorted.sort((a, b) => a.position.x - b.position.x)
  const outer = getBoxOfNodes(sorted)
  sorted.forEach((node, index) => {
    const isFirst = index === 0
    if (!isFirst) {
      const prev = sorted[index - 1]
      const prevWidth = prev.size?.width ?? 0
      sorted[index] = cloneWithPosition(node, prev.position.x + prevWidth + spacing, outer.y)
    } else {
      sorted[index] = cloneWithPosition(node, node.position.x, outer.y)
    }
  })
  return sorted
}

export const verticalSpacing = (nodes: Node[], spacing = 15): Node[] => {
  const bounded = nodes.filter(hasBounds)
  if (bounded.length === 0) return []
  const sorted = bounded.map((node) => ({ ...node, position: { ...node.position } }))
  sorted.sort((a, b) => a.position.y - b.position.y)
  const outer = getBoxOfNodes(sorted)
  sorted.forEach((node, index) => {
    const isFirst = index === 0
    if (!isFirst) {
      const prev = sorted[index - 1]
      const prevHeight = prev.size?.height ?? 0
      sorted[index] = cloneWithPosition(node, outer.x, prev.position.y + prevHeight + spacing)
    } else {
      sorted[index] = cloneWithPosition(node, outer.x, node.position.y)
    }
  })
  return sorted
}
