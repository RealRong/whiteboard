import type { ViewDebugMetric } from '@engine-types/instance/view'
import {
  DEFAULT_SAMPLE_WINDOW_SIZE,
  percentile,
  pushSample
} from '../perf/sampling'

type ViewMetricState = ViewDebugMetric & {
  samplesMs: number[]
}

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export const measureNow = now

export const createViewMetric = (): ViewMetricState => ({
  revision: 0,
  dirty: false,
  recomputeCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  cacheHitRate: 1,
  sampleCount: 0,
  sampleWindowSize: DEFAULT_SAMPLE_WINDOW_SIZE,
  p50ComputeMs: 0,
  p95ComputeMs: 0,
  lastComputeMs: 0,
  avgComputeMs: 0,
  maxComputeMs: 0,
  totalComputeMs: 0,
  lastComputedAt: undefined,
  samplesMs: []
})

const updateHitRate = (metric: ViewMetricState) => {
  const totalReads = metric.cacheHitCount + metric.cacheMissCount
  metric.cacheHitRate = totalReads > 0 ? metric.cacheHitCount / totalReads : 1
}

const updateSampleStats = (metric: ViewMetricState) => {
  metric.sampleCount = metric.samplesMs.length
  metric.p50ComputeMs = percentile(metric.samplesMs, 50)
  metric.p95ComputeMs = percentile(metric.samplesMs, 95)
}

export const markMetricHit = (metric: ViewMetricState) => {
  metric.cacheHitCount += 1
  updateHitRate(metric)
}

export const markMetricDirty = (metric: ViewMetricState) => {
  metric.dirty = true
}

export const markMetricRevision = (metric: ViewMetricState) => {
  metric.revision += 1
}

export const markMetricRecompute = (
  metric: ViewMetricState,
  elapsedMs: number,
  options?: { bumpRevision?: boolean }
) => {
  metric.recomputeCount += 1
  metric.cacheMissCount += 1
  pushSample(metric.samplesMs, elapsedMs, metric.sampleWindowSize)
  updateSampleStats(metric)
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

export const snapshotViewMetric = (metric: ViewMetricState): ViewDebugMetric => {
  const { samplesMs: _samplesMs, ...snapshot } = metric
  return snapshot
}
