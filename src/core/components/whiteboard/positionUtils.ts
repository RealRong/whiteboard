import { Box } from '~/typings'

export type idToBoxMap = Map<number, Box>
export const alignNodes = (
  alignment: 'left' | 'right' | 'verticalCenter' | 'horizontalCenter' | 'top' | 'bottom',
  map: idToBoxMap
): idToBoxMap => {
  const idToBoxMap = structuredClone(map) as idToBoxMap
  switch (alignment) {
    case 'left':
      return alignLeftNodes(idToBoxMap)
    case 'right':
      return alignRightNodes(idToBoxMap)
    case 'horizontalCenter':
      return horizontalAlignCenterNodes(idToBoxMap)
    case 'verticalCenter':
      return verticalAlignCenterNodes(idToBoxMap)
    case 'top':
      return alignTopNodes(idToBoxMap)
    case 'bottom':
      return alignBottomNodes(idToBoxMap)
  }
}

export const alignLeftNodes = (idToBoxMap: idToBoxMap) => {
  const allBoxes = Array.from(idToBoxMap.values())
  const minX = allBoxes.reduce((prev, curr) => {
    if (curr.left < prev) {
      return curr.left
    }
    return prev
  }, Number.MAX_VALUE)
  idToBoxMap.forEach(i => (i.left = minX))
  return idToBoxMap
}

export const alignRightNodes = (idToBoxMap: idToBoxMap) => {
  const allBoxes = Array.from(idToBoxMap.values())
  const maxX = allBoxes.reduce((prev, curr) => {
    const right = curr.left + curr.width
    if (right > prev) {
      return right
    }

    return prev
  }, Number.MIN_SAFE_INTEGER)

  idToBoxMap.forEach(i => (i.left = maxX - i.width))
  return idToBoxMap
}

export const alignBottomNodes = (idToBoxMap: idToBoxMap) => {
  const allBoxes = Array.from(idToBoxMap.values())
  const maxY = allBoxes.reduce((prev, curr) => {
    const bottom = curr.top + curr.height
    if (bottom > prev) {
      return bottom
    }
    return prev
  }, Number.MIN_SAFE_INTEGER)
  idToBoxMap.forEach(i => (i.top = maxY - i.height))
  return idToBoxMap
}
export const alignTopNodes = (idToBoxMap: idToBoxMap) => {
  const allBoxes = Array.from(idToBoxMap.values())
  const minY = allBoxes.reduce((prev, curr) => {
    if (curr.top < prev) {
      return curr.top
    }
    return prev
  }, Number.MAX_VALUE)
  idToBoxMap.forEach(i => (i.top = minY))
  return idToBoxMap
}
export const horizontalAlignCenterNodes = (idToBoxMap: idToBoxMap) => {
  return idToBoxMap
}

export const verticalAlignCenterNodes = (idToBoxMap: idToBoxMap) => {
  return idToBoxMap
}
