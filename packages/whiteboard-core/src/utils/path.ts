import type { EdgeAnchor, Point } from '../types/core'

export type EdgeSide = EdgeAnchor['side']

const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom'
} as const

const handleDirections: Record<EdgeSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 }
}

const getDirection = ({
  source,
  sourcePosition = Position.Bottom,
  target
}: {
  source: Point
  sourcePosition: EdgeSide
  target: Point
}): Point => {
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 }
  }
  return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 }
}

const distance = (a: Point, b: Point) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))

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

const getPoints = ({
  source,
  sourcePosition = Position.Bottom,
  target,
  targetPosition = Position.Top,
  center,
  offset
}: {
  source: Point
  sourcePosition: EdgeSide
  target: Point
  targetPosition: EdgeSide
  center: Partial<Point>
  offset: number
}): [Point[], number, number, number, number] => {
  const sourceDir = handleDirections[sourcePosition]
  const targetDir = handleDirections[targetPosition]
  const sourceGapped: Point = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset }
  const targetGapped: Point = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset }
  const dir = getDirection({
    source: sourceGapped,
    sourcePosition,
    target: targetGapped
  })
  const dirAccessor = dir.x !== 0 ? 'x' : 'y'
  const currDir = dir[dirAccessor]

  let points: Point[] = []
  let centerX = 0
  let centerY = 0
  const sourceGapOffset = { x: 0, y: 0 }
  const targetGapOffset = { x: 0, y: 0 }

  const [defaultCenterX, defaultCenterY, defaultOffsetX, defaultOffsetY] = getEdgeCenter({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y
  })

  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    centerX = center.x ?? defaultCenterX
    centerY = center.y ?? defaultCenterY
    const verticalSplit: Point[] = [
      { x: centerX, y: sourceGapped.y },
      { x: centerX, y: targetGapped.y }
    ]
    const horizontalSplit: Point[] = [
      { x: sourceGapped.x, y: centerY },
      { x: targetGapped.x, y: centerY }
    ]

    if (sourceDir[dirAccessor] === currDir) {
      points = dirAccessor === 'x' ? verticalSplit : horizontalSplit
    } else {
      points = dirAccessor === 'x' ? horizontalSplit : verticalSplit
    }
  } else {
    const sourceTarget: Point[] = [{ x: sourceGapped.x, y: targetGapped.y }]
    const targetSource: Point[] = [{ x: targetGapped.x, y: sourceGapped.y }]
    if (dirAccessor === 'x') {
      points = sourceDir.x === currDir ? targetSource : sourceTarget
    } else {
      points = sourceDir.y === currDir ? sourceTarget : targetSource
    }

    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor])

      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff)
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] = gapOffset
        } else {
          targetGapOffset[dirAccessor] = gapOffset
        }
      }
    }

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

const getBend = (a: Point, b: Point, c: Point, size: number): string => {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size)
  const { x, y } = b

  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`
  }

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
  sourcePosition: EdgeSide
  targetPosition: EdgeSide
  targetX: number
  targetY: number
  borderRadius: number
  centerX?: number
  centerY?: number
  offset?: number
  bendOnlyLast?: boolean
}): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number, points: Point[]] {
  const [points, labelX, labelY, offsetX, offsetY] = getPoints({
    source: { x: sourceX, y: sourceY },
    sourcePosition,
    target: { x: targetX, y: targetY },
    targetPosition,
    center: { x: centerX, y: centerY },
    offset
  })

  const path = points.reduce<string>((res, point, index) => {
    let segment = ''

    if (index > 0 && index < points.length - 1) {
      if (bendOnlyLast) {
        if (index === points.length - 3) {
          segment = getBend(points[index - 1], point, points[index + 1], borderRadius)
        } else {
          segment = `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`
        }
      } else {
        segment = getBend(points[index - 1], point, points[index + 1], borderRadius)
      }
    } else {
      segment = `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`
    }

    return res + segment
  }, '')

  return [path, labelX, labelY, offsetX, offsetY, points]
}

export interface GetBezierPathParams {
  sourceX: number
  sourceY: number
  sourcePosition?: EdgeSide
  targetX: number
  targetY: number
  targetPosition?: EdgeSide
  curvature?: number
}

interface GetControlWithCurvatureParams {
  pos: EdgeSide
  x1: number
  y1: number
  x2: number
  y2: number
  c: number
}

const calculateControlOffset = (distanceValue: number, curvature: number): number => {
  if (distanceValue >= 0) {
    return 0.5 * distanceValue
  }
  return curvature * 25 * Math.sqrt(-distanceValue)
}

const getControlWithCurvature = ({ pos, x1, y1, x2, y2, c }: GetControlWithCurvatureParams): [number, number] => {
  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1]
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1]
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)]
    case Position.Bottom:
    default:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)]
  }
}

export function getBezierEdgeCenter({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceControlX,
  sourceControlY,
  targetControlX,
  targetControlY
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourceControlX: number
  sourceControlY: number
  targetControlX: number
  targetControlY: number
}): [number, number, number, number] {
  const centerX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125
  const centerY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125
  const offsetX = Math.abs(centerX - sourceX)
  const offsetY = Math.abs(centerY - sourceY)

  return [centerX, centerY, offsetX, offsetY]
}

export function getBezierPath({
  sourceX,
  sourceY,
  sourcePosition = 'bottom',
  targetX,
  targetY,
  targetPosition = 'top',
  curvature = 0.25
}: GetBezierPathParams): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number] {
  const [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: curvature
  })
  const [targetControlX, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: curvature
  })
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY
  })
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY
  ]
}
