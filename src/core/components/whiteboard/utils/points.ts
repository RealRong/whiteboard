export const rescalePoints = (axis: 'x' | 'y', newSize: number, points: number[][], normalize: boolean) => {
  const dimension = axis === 'x' ? 0 : 1
  const coordinates = points.map(p => p[dimension])
  const maxCoord = Math.max(...coordinates)
  const minCoord = Math.min(...coordinates)
  const size = maxCoord - minCoord
  const scale = size === 0 ? 1 : newSize / size
  let nextMinCoord = Infinity
  const scaledPoints = points.map(p => {
    const newCoord = p[dimension] * scale
    const newPoint = [...p]
    newPoint[dimension] = newCoord
    if (newCoord < nextMinCoord) {
      nextMinCoord = newCoord
    }
    return newPoint
  })
  if (!normalize) return scaledPoints
  if (scaledPoints.length === 2) {
    return scaledPoints
  }
  const translation = minCoord - nextMinCoord
  const nextPoints = scaledPoints.map(p =>
    p.map((v, currDimen) => {
      return currDimen === dimension ? v + translation : v
    })
  )
  return nextPoints
}
