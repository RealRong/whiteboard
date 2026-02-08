import type { Rect } from '@whiteboard/core'
import type { GridIndex, Guide, SnapCandidate, SnapEdge, SnapResult } from 'types/node/snap'

const keyForCell = (cx: number, cy: number) => `${cx},${cy}`

const getCellRange = (rect: Rect, cellSize: number) => {
  const minX = Math.floor(rect.x / cellSize)
  const maxX = Math.floor((rect.x + rect.width) / cellSize)
  const minY = Math.floor(rect.y / cellSize)
  const maxY = Math.floor((rect.y + rect.height) / cellSize)
  return { minX, maxX, minY, maxY }
}

export const buildSnapCandidates = (items: Array<{ id: string; rect: Rect }>): SnapCandidate[] => {
  return items.map((item) => {
    const { rect } = item
    return {
      id: item.id,
      rect,
      lines: {
        left: rect.x,
        right: rect.x + rect.width,
        centerX: rect.x + rect.width / 2,
        top: rect.y,
        bottom: rect.y + rect.height,
        centerY: rect.y + rect.height / 2
      }
    }
  })
}

export const createGridIndex = (candidates: SnapCandidate[], cellSize: number): GridIndex => {
  const buckets = new Map<string, Set<string>>()
  const items = new Map<string, SnapCandidate>()
  candidates.forEach((candidate) => {
    items.set(candidate.id, candidate)
    const { minX, maxX, minY, maxY } = getCellRange(candidate.rect, cellSize)
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const key = keyForCell(cx, cy)
        const bucket = buckets.get(key) ?? new Set<string>()
        bucket.add(candidate.id)
        buckets.set(key, bucket)
      }
    }
  })
  return { cellSize, buckets, items }
}

export const queryGridIndex = (index: GridIndex, rect: Rect): SnapCandidate[] => {
  const { minX, maxX, minY, maxY } = getCellRange(rect, index.cellSize)
  const ids = new Set<string>()
  for (let cx = minX; cx <= maxX; cx += 1) {
    for (let cy = minY; cy <= maxY; cy += 1) {
      const bucket = index.buckets.get(keyForCell(cx, cy))
      if (!bucket) continue
      bucket.forEach((id) => ids.add(id))
    }
  }
  return Array.from(ids)
    .map((id) => index.items.get(id))
    .filter((item): item is SnapCandidate => Boolean(item))
}

const edgePriority = (edge: SnapEdge) => {
  if (edge === 'centerX' || edge === 'centerY') return 0
  return 1
}

export const computeSnap = (
  movingRect: Rect,
  candidates: SnapCandidate[],
  threshold: number,
  excludeId?: string,
  options?: { allowCross?: boolean; crossThreshold?: number }
): SnapResult => {
  const allowCross = options?.allowCross ?? false
  const crossThreshold = options?.crossThreshold ?? threshold * 0.6
  const movingLines = {
    left: movingRect.x,
    right: movingRect.x + movingRect.width,
    centerX: movingRect.x + movingRect.width / 2,
    top: movingRect.y,
    bottom: movingRect.y + movingRect.height,
    centerY: movingRect.y + movingRect.height / 2
  }

  let bestX: { delta: number; distance: number; target: SnapCandidate; targetEdge: SnapEdge; sourceEdge: SnapEdge } | undefined
  let bestY: { delta: number; distance: number; target: SnapCandidate; targetEdge: SnapEdge; sourceEdge: SnapEdge } | undefined

  for (const candidate of candidates) {
    if (candidate.id === excludeId) continue
    const targetLines = candidate.lines

    const xPairs: Array<[SnapEdge, SnapEdge]> = [
      ['centerX', 'centerX'],
      ['left', 'left'],
      ['right', 'right']
    ]
    if (allowCross) {
      xPairs.push(
        ['left', 'centerX'],
        ['left', 'right'],
        ['centerX', 'left'],
        ['centerX', 'right'],
        ['right', 'left'],
        ['right', 'centerX']
      )
    }
    xPairs.forEach(([sourceEdge, targetEdge]) => {
      const delta = targetLines[targetEdge as keyof typeof targetLines] - movingLines[sourceEdge as keyof typeof movingLines]
      const dist = Math.abs(delta)
      const limit = sourceEdge === targetEdge ? threshold : crossThreshold
      if (dist > limit) return
      if (
        !bestX ||
        dist < bestX.distance ||
        (dist === bestX.distance && edgePriority(sourceEdge) < edgePriority(bestX.sourceEdge))
      ) {
        bestX = {
          delta,
          distance: dist,
          target: candidate,
          targetEdge,
          sourceEdge
        }
      }
    })

    const yPairs: Array<[SnapEdge, SnapEdge]> = [
      ['centerY', 'centerY'],
      ['top', 'top'],
      ['bottom', 'bottom']
    ]
    if (allowCross) {
      yPairs.push(
        ['top', 'centerY'],
        ['top', 'bottom'],
        ['centerY', 'top'],
        ['centerY', 'bottom'],
        ['bottom', 'top'],
        ['bottom', 'centerY']
      )
    }
    yPairs.forEach(([sourceEdge, targetEdge]) => {
      const delta = targetLines[targetEdge as keyof typeof targetLines] - movingLines[sourceEdge as keyof typeof movingLines]
      const dist = Math.abs(delta)
      const limit = sourceEdge === targetEdge ? threshold : crossThreshold
      if (dist > limit) return
      if (
        !bestY ||
        dist < bestY.distance ||
        (dist === bestY.distance && edgePriority(sourceEdge) < edgePriority(bestY.sourceEdge))
      ) {
        bestY = {
          delta,
          distance: dist,
          target: candidate,
          targetEdge,
          sourceEdge
        }
      }
    })
  }

  const guides: Guide[] = []
  if (bestX) {
    const targetRect = bestX.target.rect
    const from = Math.min(movingRect.y, targetRect.y)
    const to = Math.max(movingRect.y + movingRect.height, targetRect.y + targetRect.height)
    guides.push({
      axis: 'x',
      value: movingLines[bestX.sourceEdge as keyof typeof movingLines] + bestX.delta,
      from,
      to,
      targetEdge: bestX.targetEdge,
      sourceEdge: bestX.sourceEdge
    })
  }
  if (bestY) {
    const targetRect = bestY.target.rect
    const from = Math.min(movingRect.x, targetRect.x)
    const to = Math.max(movingRect.x + movingRect.width, targetRect.x + targetRect.width)
    guides.push({
      axis: 'y',
      value: movingLines[bestY.sourceEdge as keyof typeof movingLines] + bestY.delta,
      from,
      to,
      targetEdge: bestY.targetEdge,
      sourceEdge: bestY.sourceEdge
    })
  }

  return {
    dx: bestX ? bestX.delta : undefined,
    dy: bestY ? bestY.delta : undefined,
    guides,
    snappedEdges: {
      x: bestX ? { targetEdge: bestX.targetEdge, sourceEdge: bestX.sourceEdge } : undefined,
      y: bestY ? { targetEdge: bestY.targetEdge, sourceEdge: bestY.sourceEdge } : undefined
    }
  }
}
