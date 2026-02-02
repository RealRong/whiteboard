import type { Node } from '../types/core'
import { getBoxOfNodes } from './box'

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'horizontallyCenter' | 'verticallyCenter'

const hasBounds = (node: Node) => node.size?.width !== undefined && node.size?.height !== undefined

const cloneWithPosition = (node: Node, x: number, y: number): Node => ({
  ...node,
  position: {
    x,
    y
  }
})

export const alignNodes = (alignment: AlignMode, nodes: Node[]): Node[] => {
  const filteredNodes = nodes.filter(hasBounds)
  if (filteredNodes.length === 0) return []
  const updated = filteredNodes.map((node) => ({ ...node, position: { ...node.position } }))

  switch (alignment) {
    case 'left':
      alignLeftNodes(updated)
      break
    case 'right':
      alignRightNodes(updated)
      break
    case 'top':
      alignTopNodes(updated)
      break
    case 'bottom':
      alignBottomNodes(updated)
      break
    case 'centerX':
    case 'verticallyCenter':
      alignCenterXNodes(updated)
      break
    case 'centerY':
    case 'horizontallyCenter':
      alignCenterYNodes(updated)
      break
    default:
      break
  }

  return updated
}

export const alignLeftNodes = (nodes: Node[]) => {
  const minX = nodes.reduce((prev, curr) => (curr.position.x < prev ? curr.position.x : prev), Number.POSITIVE_INFINITY)
  nodes.forEach((node, index) => {
    nodes[index] = cloneWithPosition(node, minX, node.position.y)
  })
}

export const alignRightNodes = (nodes: Node[]) => {
  const maxX = nodes.reduce((prev, curr) => {
    const width = curr.size?.width ?? 0
    const right = curr.position.x + width
    return right > prev ? right : prev
  }, Number.NEGATIVE_INFINITY)

  nodes.forEach((node, index) => {
    const width = node.size?.width ?? 0
    nodes[index] = cloneWithPosition(node, maxX - width, node.position.y)
  })
}

export const alignTopNodes = (nodes: Node[]) => {
  const minY = nodes.reduce((prev, curr) => (curr.position.y < prev ? curr.position.y : prev), Number.POSITIVE_INFINITY)
  nodes.forEach((node, index) => {
    nodes[index] = cloneWithPosition(node, node.position.x, minY)
  })
}

export const alignBottomNodes = (nodes: Node[]) => {
  const maxY = nodes.reduce((prev, curr) => {
    const height = curr.size?.height ?? 0
    const bottom = curr.position.y + height
    return bottom > prev ? bottom : prev
  }, Number.NEGATIVE_INFINITY)
  nodes.forEach((node, index) => {
    const height = node.size?.height ?? 0
    nodes[index] = cloneWithPosition(node, node.position.x, maxY - height)
  })
}

export const alignCenterXNodes = (nodes: Node[]) => {
  const box = getBoxOfNodes(nodes)
  const centerX = box.x + box.width / 2
  nodes.forEach((node, index) => {
    const width = node.size?.width ?? 0
    nodes[index] = cloneWithPosition(node, centerX - width / 2, node.position.y)
  })
}

export const alignCenterYNodes = (nodes: Node[]) => {
  const box = getBoxOfNodes(nodes)
  const centerY = box.y + box.height / 2
  nodes.forEach((node, index) => {
    const height = node.size?.height ?? 0
    nodes[index] = cloneWithPosition(node, node.position.x, centerY - height / 2)
  })
}
