import type { Instance } from '@engine-types/instance'

export type PointerSessionBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type Options<TActive> = {
  events: Instance['runtime']['events']
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId?: (active: TActive) => number | undefined | null
  onPointerMove?: (event: PointerEvent, active: TActive) => void
  onPointerUp?: (event: PointerEvent, active: TActive) => void
  onPointerCancel?: (event: PointerEvent, active: TActive) => void
}

export const createPointerSession = <TActive>({
  events,
  watch,
  getActive,
  getPointerId,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: Options<TActive>): PointerSessionBinding => {
  let offWatch: (() => void) | null = null
  let offWindow: (() => void) | null = null

  const isPointerMatch = (event: PointerEvent, active: TActive) => {
    const pointerId = getPointerId?.(active)
    if (pointerId === undefined || pointerId === null) return true
    return event.pointerId === pointerId
  }

  const sync = () => {
    const active = getActive()

    if (!active) {
      offWindow?.()
      offWindow = null
      return
    }

    if (offWindow) return

    const offList: Array<() => void> = []

    if (onPointerMove) {
      offList.push(
        events.onWindow('pointermove', (event) => {
          const latest = getActive()
          if (!latest || !isPointerMatch(event, latest)) return
          onPointerMove(event, latest)
        })
      )
    }

    if (onPointerUp) {
      offList.push(
        events.onWindow('pointerup', (event) => {
          const latest = getActive()
          if (!latest || !isPointerMatch(event, latest)) return
          onPointerUp(event, latest)
        })
      )
    }

    if (onPointerCancel) {
      offList.push(
        events.onWindow('pointercancel', (event) => {
          const latest = getActive()
          if (!latest || !isPointerMatch(event, latest)) return
          onPointerCancel(event, latest)
        })
      )
    }

    offWindow = () => {
      offList.forEach((off) => off())
    }
  }

  const start = () => {
    if (offWatch) return
    offWatch = watch(sync)
    sync()
  }

  const stop = () => {
    offWindow?.()
    offWindow = null
    offWatch?.()
    offWatch = null
  }

  return {
    start,
    sync,
    stop
  }
}
