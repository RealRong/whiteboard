import { XYPosition, EdgePosition } from '~/typings'

const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom'
}

const handleDirections = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 }
}
const getDirection = ({
  source,
  sourcePosition = Position.Bottom,
  target
}: {
  source: XYPosition
  sourcePosition: EdgePosition
  target: XYPosition
}): XYPosition => {
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 }
  }
  return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 }
}

const distance = (a: XYPosition, b: XYPosition) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))

export function getEdgeCenter({
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}): [number, number, number, number] {
  const xOffset = Math.abs(targetX - sourceX) / 2
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset

  const yOffset = Math.abs(targetY - sourceY) / 2
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset

  return [centerX, centerY, xOffset, yOffset]
}

function getPoints({
  source,
  sourcePosition = Position.Bottom,
  target,
  targetPosition = Position.Top,
  center,
  offset
}: {
  source: XYPosition
  sourcePosition: EdgePosition
  target: XYPosition
  targetPosition: EdgePosition
  center: Partial<XYPosition>
  offset: number
}): [XYPosition[], number, number, number, number] {
  const sourceDir = handleDirections[sourcePosition]
  const targetDir = handleDirections[targetPosition]
  const sourceGapped: XYPosition = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset }
  const targetGapped: XYPosition = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset }
  const dir = getDirection({
    source: sourceGapped,
    sourcePosition,
    target: targetGapped
  })
  const dirAccessor = dir.x !== 0 ? 'x' : 'y'
  const currDir = dir[dirAccessor]

  let points: XYPosition[] = []
  let centerX, centerY
  const sourceGapOffset = { x: 0, y: 0 }
  const targetGapOffset = { x: 0, y: 0 }

  const [defaultCenterX, defaultCenterY, defaultOffsetX, defaultOffsetY] = getEdgeCenter({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y
  })

  // opposite handle positions, default case
  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    centerX = center.x || defaultCenterX
    centerY = center.y || defaultCenterY
    //    --->
    //    |
    // >---
    const verticalSplit: XYPosition[] = [
      { x: centerX, y: sourceGapped.y },
      { x: centerX, y: targetGapped.y }
    ]
    //    |
    //  ---
    //  |
    const horizontalSplit: XYPosition[] = [
      { x: sourceGapped.x, y: centerY },
      { x: targetGapped.x, y: centerY }
    ]

    if (sourceDir[dirAccessor] === currDir) {
      points = dirAccessor === 'x' ? verticalSplit : horizontalSplit
    } else {
      points = dirAccessor === 'x' ? horizontalSplit : verticalSplit
    }
  } else {
    // sourceTarget means we take x from source and y from target, targetSource is the opposite
    const sourceTarget: XYPosition[] = [{ x: sourceGapped.x, y: targetGapped.y }]
    const targetSource: XYPosition[] = [{ x: targetGapped.x, y: sourceGapped.y }]
    // this handles edges with same handle positions
    if (dirAccessor === 'x') {
      points = sourceDir.x === currDir ? targetSource : sourceTarget
    } else {
      points = sourceDir.y === currDir ? sourceTarget : targetSource
    }

    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor])

      // if an edge goes from right to right for example (sourcePosition === targetPosition) and the distance between source.x and target.x is less than the offset, the added point and the gapped source/target will overlap. This leads to a weird edge path. To avoid this we add a gapOffset to the source/target
      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff)
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] = gapOffset
        } else {
          targetGapOffset[dirAccessor] = gapOffset
        }
      }
    }

    // these are conditions for handling mixed handle positions like Right -> Bottom for example
    if (sourcePosition !== targetPosition) {
      const dirAccessorOpposite = dirAccessor === 'x' ? 'y' : 'x'
      const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite]
      const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite]
      const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite]
      const flipSourceTarget =
        (sourceDir[dirAccessor] === 1 && ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo))) ||
        (sourceDir[dirAccessor] !== 1 && ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)))

      if (flipSourceTarget) {
        points = dirAccessor === 'x' ? sourceTarget : targetSource
      }
    }

    const sourceGapPoint = { x: sourceGapped.x - sourceGapOffset.x, y: sourceGapped.y - sourceGapOffset.y }
    const targetGapPoint = { x: targetGapped.x - targetGapOffset.x, y: targetGapped.y - targetGapOffset.y }
    const maxXDistance = Math.max(Math.abs(sourceGapPoint.x - points[0].x), Math.abs(targetGapPoint.x - points[0].x))
    const maxYDistance = Math.max(Math.abs(sourceGapPoint.y - points[0].y), Math.abs(targetGapPoint.y - points[0].y))

    // we want to place the label on the longest segment of the edge
    if (maxXDistance >= maxYDistance) {
      centerX = (sourceGapPoint.x + targetGapPoint.x) / 2
      centerY = points[0].y
    } else {
      centerX = points[0].x
      centerY = (sourceGapPoint.y + targetGapPoint.y) / 2
    }
  }

  const pathPoints = [
    source,
    { x: sourceGapped.x - sourceGapOffset.x, y: sourceGapped.y - sourceGapOffset.y },
    ...points,
    { x: targetGapped.x - targetGapOffset.x, y: targetGapped.y - targetGapOffset.y },
    target
  ]
  if (sourcePosition === 'left' && targetPosition === 'left' && pathPoints.length === 5) {
    const tsd = target.x - source.x
    if (tsd > 0 && tsd <= offset) {
      pathPoints.splice(pathPoints.length - 2, 1)
    } else if (tsd <= 0) {
      pathPoints.splice(1, 1)
    }
  }
  if (sourcePosition === 'top' && targetPosition === 'top' && pathPoints.length === 5) {
    const tsd = target.y - source.y
    if (tsd > 0 && tsd <= offset) {
      pathPoints.splice(pathPoints.length - 2, 1)
    } else if (tsd <= 0) {
      pathPoints.splice(1, 1)
    }
  }
  return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY]
}

function getBend(a: XYPosition, b: XYPosition, c: XYPosition, size: number): string {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size)
  const { x, y } = b

  // no bend
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`
  }

  // first segment is horizontal
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1
    const yDir = a.y < c.y ? 1 : -1
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`
  }

  const xDir = a.x < c.x ? 1 : -1
  const yDir = a.y < c.y ? -1 : 1
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`
}
export function getSmoothPolyPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  borderRadius = 5,
  centerX,
  centerY,
  offset = 50,
  bendOnlyLast = false
}: {
  sourceX: number
  sourceY: number
  sourcePosition: EdgePosition
  targetPosition: EdgePosition
  targetX: number
  targetY: number
  borderRadius: number
  centerX?: number
  centerY?: number
  offset?: number
  bendOnlyLast?: boolean
}): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number, points] {
  const [points, labelX, labelY, offsetX, offsetY] = getPoints({
    source: { x: sourceX, y: sourceY },
    sourcePosition,
    target: { x: targetX, y: targetY },
    targetPosition,
    center: { x: centerX, y: centerY },
    offset
  })

  const path = points.reduce<string>((res, p, i) => {
    let segment = ''

    if (i > 0 && i < points.length - 1) {
      if (bendOnlyLast) {
        if (i === points.length - 3) {
          segment = getBend(points[i - 1], p, points[i + 1], borderRadius)
        } else {
          segment = `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`
        }
      } else {
        segment = getBend(points[i - 1], p, points[i + 1], borderRadius)
      }
    } else {
      segment = `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`
    }

    res += segment

    return res
  }, '')

  return [path, labelX, labelY, offsetX, offsetY, points]
}
