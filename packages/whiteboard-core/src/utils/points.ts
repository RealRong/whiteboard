export const rescalePoints = (axis: 'x' | 'y', newSize: number, points: number[][], normalize: boolean) => {
  const dimension = axis === 'x' ? 0 : 1
  const coordinates = points.map((point) => point[dimension])
  const maxCoord = Math.max(...coordinates)
  const minCoord = Math.min(...coordinates)
  const size = maxCoord - minCoord
  const scale = size === 0 ? 1 : newSize / size
  let nextMinCoord = Infinity
  const scaledPoints = points.map((point) => {
    const newCoord = point[dimension] * scale
    const nextPoint = [...point]
    nextPoint[dimension] = newCoord
    if (newCoord < nextMinCoord) {
      nextMinCoord = newCoord
    }
    return nextPoint
  })
  if (!normalize) return scaledPoints
  if (scaledPoints.length === 2) {
    return scaledPoints
  }
  const translation = minCoord - nextMinCoord
  return scaledPoints.map((point) =>
    point.map((value, index) => (index === dimension ? value + translation : value))
  )
}
