import type { Point } from '@whiteboard/core/types'
import type { WhiteboardViewport } from '../viewport'

export type PanPointer = Readonly<{
  clientX: number
  clientY: number
}>

export type PanDriver = Readonly<{
  update: (pointer: PanPointer) => void
  stop: () => void
}>

type PanVector = Point

const DEFAULT_THRESHOLD = 96
const DEFAULT_MAX_SPEED = 1200
const MAX_FRAME_SECONDS = 1 / 20
const MIN_ZOOM = 0.0001

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const resolveAxisSpeed = (
  point: number,
  size: number,
  threshold: number,
  maxSpeed: number
) => {
  if (!Number.isFinite(point) || !Number.isFinite(size) || size <= 0) {
    return 0
  }

  const distanceToStart = point
  const distanceToEnd = size - point

  if (distanceToStart <= threshold) {
    const strength = clamp(
      (threshold - Math.max(distanceToStart, 0)) / threshold,
      0,
      1
    )
    return -(strength ** 2) * maxSpeed
  }

  if (distanceToEnd <= threshold) {
    const strength = clamp(
      (threshold - Math.max(distanceToEnd, 0)) / threshold,
      0,
      1
    )
    return (strength ** 2) * maxSpeed
  }

  return 0
}

export const resolvePanVector = ({
  point,
  size,
  threshold,
  maxSpeed
}: {
  point: Point
  size: {
    width: number
    height: number
  }
  threshold?: number
  maxSpeed?: number
}): PanVector => {
  const safeThreshold = Math.max(1, threshold ?? DEFAULT_THRESHOLD)
  const safeMaxSpeed = Math.max(0, maxSpeed ?? DEFAULT_MAX_SPEED)

  return {
    x: resolveAxisSpeed(point.x, size.width, safeThreshold, safeMaxSpeed),
    y: resolveAxisSpeed(point.y, size.height, safeThreshold, safeMaxSpeed)
  }
}

export const createPanDriver = ({
  viewport,
  enabled,
  onFrame,
  threshold,
  maxSpeed
}: {
  viewport: Pick<WhiteboardViewport, 'clientToScreen' | 'get' | 'panBy' | 'size'>
  enabled?: () => boolean
  onFrame?: (pointer: PanPointer) => void
  threshold?: number
  maxSpeed?: number
}): PanDriver => {
  let frameId: number | null = null
  let lastFrameTime = 0
  let pointer: PanPointer | null = null

  const stop = () => {
    if (
      frameId !== null
      && typeof window !== 'undefined'
      && typeof window.cancelAnimationFrame === 'function'
    ) {
      window.cancelAnimationFrame(frameId)
    }

    frameId = null
    lastFrameTime = 0
    pointer = null
  }

  const schedule = () => {
    if (
      frameId !== null
      || typeof window === 'undefined'
      || typeof window.requestAnimationFrame !== 'function'
    ) {
      return
    }

    frameId = window.requestAnimationFrame((timestamp) => {
      frameId = null

      if (!pointer || (enabled && !enabled())) {
        lastFrameTime = 0
        return
      }

      const screen = viewport.clientToScreen(pointer.clientX, pointer.clientY)
      const vector = resolvePanVector({
        point: screen,
        size: viewport.size(),
        threshold,
        maxSpeed
      })
      if (vector.x === 0 && vector.y === 0) {
        lastFrameTime = 0
        return
      }

      const deltaSeconds = clamp(
        lastFrameTime === 0 ? 1 / 60 : (timestamp - lastFrameTime) / 1000,
        1 / 120,
        MAX_FRAME_SECONDS
      )
      lastFrameTime = timestamp

      const zoom = Math.max(viewport.get().zoom, MIN_ZOOM)
      viewport.panBy({
        x: (vector.x * deltaSeconds) / zoom,
        y: (vector.y * deltaSeconds) / zoom
      })
      onFrame?.(pointer)
      schedule()
    })
  }

  return {
    update: (nextPointer) => {
      pointer = {
        clientX: nextPointer.clientX,
        clientY: nextPointer.clientY
      }

      if (enabled && !enabled()) {
        stop()
        return
      }

      const screen = viewport.clientToScreen(pointer.clientX, pointer.clientY)
      const vector = resolvePanVector({
        point: screen,
        size: viewport.size(),
        threshold,
        maxSpeed
      })

      if (vector.x === 0 && vector.y === 0) {
        if (frameId === null) {
          lastFrameTime = 0
        }
        return
      }

      schedule()
    },
    stop
  }
}
