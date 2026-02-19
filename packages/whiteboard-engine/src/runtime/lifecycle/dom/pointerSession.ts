export type PointerSessionOnWindow = (
  type: 'pointermove' | 'pointerup' | 'pointercancel',
  listener: (event: PointerEvent) => void
) => () => void

export type PointerSessionBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type SelectionBoxAccess = {
  watchActive: (listener: () => void) => () => void
  getPointerId: () => number | null
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handlePointerCancel: (event: PointerEvent) => void
}

export type PointerSessionHandler = {
  watch: (listener: () => void) => () => void
  getActive: () => unknown
  getPointerId?: (active: unknown) => number | undefined | null
  onMove?: (event: PointerEvent, active: unknown) => void
  onUp?: (event: PointerEvent, active: unknown) => void
  onCancel?: (event: PointerEvent, active: unknown) => void
}

type PointerWindowHubOptions = {
  onWindow: PointerSessionOnWindow
  handlers: PointerSessionHandler[]
}

const createPointerHubBinding = ({
  onWindow,
  handlers
}: PointerWindowHubOptions): PointerSessionBinding => {
  let offWatch: (() => void) | null = null
  let offWindow: (() => void) | null = null

  const isPointerMatch = (
    event: PointerEvent,
    pointerId: number | undefined | null
  ) => {
    if (pointerId === undefined || pointerId === null) return true
    return pointerId === event.pointerId
  }

  const dispatch = (type: 'move' | 'up' | 'cancel', event: PointerEvent) => {
    for (const handler of handlers) {
      const active = handler.getActive()
      if (!active) continue

      const pointerId = handler.getPointerId?.(active)
      if (!isPointerMatch(event, pointerId)) continue

      if (type === 'move') {
        handler.onMove?.(event, active)
        continue
      }

      if (type === 'up') {
        handler.onUp?.(event, active)
        continue
      }

      handler.onCancel?.(event, active)
    }
  }

  const hasActiveHandler = () => {
    for (const handler of handlers) {
      if (handler.getActive()) return true
    }
    return false
  }

  const sync = () => {
    if (!hasActiveHandler()) {
      offWindow?.()
      offWindow = null
      return
    }

    if (offWindow) return

    const offList: Array<() => void> = []
    offList.push(onWindow('pointermove', (event) => dispatch('move', event)))
    offList.push(onWindow('pointerup', (event) => dispatch('up', event)))
    offList.push(onWindow('pointercancel', (event) => dispatch('cancel', event)))

    offWindow = () => {
      offList.forEach((off) => off())
    }
  }

  const start = () => {
    if (offWatch) return
    const offWatchers = handlers.map((handler) => handler.watch(sync))
    offWatch = () => {
      offWatchers.forEach((off) => off())
    }
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

type SelectionBoxOptions = {
  getSelectionBox: () => SelectionBoxAccess
}

export const createSelectionBoxHandler = ({
  getSelectionBox
}: SelectionBoxOptions): PointerSessionHandler => ({
  watch: (listener) => getSelectionBox().watchActive(listener),
  getActive: () => {
    const selectionBox = getSelectionBox()
    const pointerId = selectionBox.getPointerId()
    if (pointerId === null) return undefined
    return { pointerId }
  },
  getPointerId: (active) => (active as { pointerId: number }).pointerId,
  onMove: (event) => {
    getSelectionBox().handlePointerMove(event)
  },
  onUp: (event) => {
    getSelectionBox().handlePointerUp(event)
  },
  onCancel: (event) => {
    getSelectionBox().handlePointerCancel(event)
  }
})

export const createPointerWindowHub = (
  options: PointerWindowHubOptions
): PointerSessionBinding => createPointerHubBinding(options)
