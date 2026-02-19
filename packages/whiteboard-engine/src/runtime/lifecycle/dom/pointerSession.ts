export type PointerSessionOnWindow = (
  type: 'pointermove' | 'pointerup' | 'pointercancel',
  listener: (event: PointerEvent) => void
) => () => void

export type PointerSessionBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type Options<TActive> = {
  onWindow: PointerSessionOnWindow
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId?: (active: TActive) => number | undefined | null
  onPointerMove?: (event: PointerEvent, active: TActive) => void
  onPointerUp?: (event: PointerEvent, active: TActive) => void
  onPointerCancel?: (event: PointerEvent, active: TActive) => void
}

export const createPointerSession = <TActive>({
  onWindow,
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
        onWindow('pointermove', (event) => {
          const latest = getActive()
          if (!latest || !isPointerMatch(event, latest)) return
          onPointerMove(event, latest)
        })
      )
    }

    if (onPointerUp) {
      offList.push(
        onWindow('pointerup', (event) => {
          const latest = getActive()
          if (!latest || !isPointerMatch(event, latest)) return
          onPointerUp(event, latest)
        })
      )
    }

    if (onPointerCancel) {
      offList.push(
        onWindow('pointercancel', (event) => {
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
