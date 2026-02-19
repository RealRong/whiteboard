export const DEFAULT_SAMPLE_WINDOW_SIZE = 64

export const pushSample = (
  samples: number[],
  value: number,
  windowSize = DEFAULT_SAMPLE_WINDOW_SIZE
) => {
  samples.push(value)
  if (samples.length <= windowSize) return
  samples.splice(0, samples.length - windowSize)
}

export const percentile = (samples: number[], p: number): number => {
  if (!samples.length) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  const ratio = Math.max(0, Math.min(100, p)) / 100
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1))
  return sorted[index] ?? 0
}
