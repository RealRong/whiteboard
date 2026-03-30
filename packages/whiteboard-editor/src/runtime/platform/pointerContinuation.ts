export type PointerContinuationInput = {
  pointerId?: number
  capture?: Element | null
  move: (event: PointerEvent) => void
  up: (event: PointerEvent) => void
  cancel: (event: PointerEvent) => void
}

export type PointerContinuation = {
  start: (input: PointerContinuationInput) => () => void
}

const releaseCapture = (
  target: Element | null | undefined,
  pointerId: number | undefined
) => {
  if (!target || pointerId === undefined) {
    return
  }

  const release = (target as Element & {
    releasePointerCapture?: (nextPointerId: number) => void
  }).releasePointerCapture

  if (typeof release !== 'function') {
    return
  }

  try {
    release.call(target, pointerId)
  } catch {
    // Ignore pointer release failures.
  }
}

const capturePointer = (
  target: Element | null | undefined,
  pointerId: number | undefined
) => {
  if (!target || pointerId === undefined) {
    return
  }

  const capture = (target as Element & {
    setPointerCapture?: (nextPointerId: number) => void
  }).setPointerCapture

  if (typeof capture !== 'function') {
    return
  }

  try {
    capture.call(target, pointerId)
  } catch {
    // Ignore pointer capture failures.
  }
}

export const createBrowserPointerContinuation = (): PointerContinuation => ({
  start: ({
    pointerId,
    capture,
    move,
    up,
    cancel
  }) => {
    capturePointer(capture, pointerId)

    if (typeof window === 'undefined') {
      return () => {
        releaseCapture(capture, pointerId)
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)

    let released = false

    return () => {
      if (released) {
        return
      }
      released = true

      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      releaseCapture(capture, pointerId)
    }
  }
})
