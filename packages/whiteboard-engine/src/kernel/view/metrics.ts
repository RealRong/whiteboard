import type { ViewDebugMetric } from '@engine-types/instance/view'

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export const measureNow = now

export const createViewMetric = (): ViewDebugMetric => ({
  revision: 0,
  dirty: false,
  recomputeCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  cacheHitRate: 1,
  lastComputeMs: 0,
  avgComputeMs: 0,
  maxComputeMs: 0,
  totalComputeMs: 0,
  lastComputedAt: undefined
})

const updateHitRate = (metric: ViewDebugMetric) => {
  const totalReads = metric.cacheHitCount + metric.cacheMissCount
  metric.cacheHitRate = totalReads > 0 ? metric.cacheHitCount / totalReads : 1
}

export const markMetricHit = (metric: ViewDebugMetric) => {
  metric.cacheHitCount += 1
  updateHitRate(metric)
}

export const markMetricDirty = (metric: ViewDebugMetric) => {
  metric.dirty = true
}

export const markMetricRevision = (metric: ViewDebugMetric) => {
  metric.revision += 1
}

export const markMetricRecompute = (
  metric: ViewDebugMetric,
  elapsedMs: number,
  options?: { bumpRevision?: boolean }
) => {
  metric.recomputeCount += 1
  metric.cacheMissCount += 1
  metric.totalComputeMs += elapsedMs
  metric.lastComputeMs = elapsedMs
  metric.maxComputeMs = Math.max(metric.maxComputeMs, elapsedMs)
  metric.avgComputeMs =
    metric.recomputeCount > 0 ? metric.totalComputeMs / metric.recomputeCount : 0
  metric.lastComputedAt = Date.now()
  metric.dirty = false
  if (options?.bumpRevision) {
    markMetricRevision(metric)
  }
  updateHitRate(metric)
}

export const snapshotViewMetric = (metric: ViewDebugMetric): ViewDebugMetric => ({
  ...metric
})
