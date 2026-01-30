import produce from 'immer'
import { IWhiteboardAlignment, IWhiteboardNode } from '~/typings'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'

export default (alignment: IWhiteboardAlignment, nodes: IWhiteboardNode[]): IWhiteboardNode[] => {
  const filteredNodes = nodes.filter(
    i => i.x !== undefined && i.y !== undefined && i.width !== undefined && i.height !== undefined
  ) as Required<IWhiteboardNode>[]
  return produce(filteredNodes, draft => {
    switch (alignment) {
      case 'left':
        alignLeftNodes(draft)
        break
      case 'right':
        alignRightNodes(draft)
        break
      case 'horizontallyCenter':
        horizontalAlignCenterNodes(draft)
        break
      case 'verticallyCenter':
        verticalAlignCenterNodes(draft)
        break
      case 'top':
        alignTopNodes(draft)
        break
      case 'bottom':
        alignBottomNodes(draft)
        break
    }
  })
}

export const alignLeftNodes = (nodes: IWhiteboardNode[]) => {
  const minX = nodes.reduce((prev, curr) => {
    if (curr.x < prev) {
      return curr.x
    }
    return prev
  }, Number.MAX_VALUE)
  nodes.forEach(i => (i.x = minX))
}

export const alignRightNodes = (nodes: Required<IWhiteboardNode>[]) => {
  const maxX = nodes.reduce((prev, curr) => {
    const right = curr.x + curr.width
    if (right > prev) {
      return right
    }

    return prev
  }, Number.MIN_SAFE_INTEGER)

  nodes.forEach(i => (i.x = maxX - i.width))
}

export const alignBottomNodes = (nodes: Required<IWhiteboardNode>[]) => {
  const maxY = nodes.reduce((prev, curr) => {
    const bottom = curr.y + curr.height
    if (bottom > prev) {
      return bottom
    }
    return prev
  }, Number.MIN_SAFE_INTEGER)
  nodes.forEach(i => (i.y = maxY - i.height))
}
export const alignTopNodes = (nodes: Required<IWhiteboardNode>[]) => {
  const minY = nodes.reduce((prev, curr) => {
    if (curr.y < prev) {
      return curr.y
    }
    return prev
  }, Number.MAX_VALUE)
  nodes.forEach(i => (i.y = minY))
}
export const horizontalAlignCenterNodes = (nodes: IWhiteboardNode[]) => {
  const box = getBoxOfNodes(nodes)
  if (box) {
    nodes.forEach(i => {
      i.y = box.top - (i.height ?? 0) / 2
    })
  }
}

export const verticalAlignCenterNodes = (nodes: IWhiteboardNode[]) => {
  const box = getBoxOfNodes(nodes)
  if (box) {
    nodes.forEach(i => {
      i.x = box.left - (i.width ?? 0) / 2
    })
  }
}
