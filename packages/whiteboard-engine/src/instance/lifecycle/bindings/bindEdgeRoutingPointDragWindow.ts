import type { WhiteboardInstance } from '@engine-types/instance'

type Options = {
  state: WhiteboardInstance['state']
  events: WhiteboardInstance['runtime']['events']
  edgeCommands: Pick<
    WhiteboardInstance['commands']['edge'],
    'updateRoutingPointDrag' | 'endRoutingPointDrag' | 'cancelRoutingPointDrag'
  >
}

export type EdgeRoutingPointDragWindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createEdgeRoutingPointDragWindowBinding = ({
  state,
  events,
  edgeCommands
}: Options): EdgeRoutingPointDragWindowBinding => {
  let offDragWatch: (() => void) | null = null
  let offDragWindow: (() => void) | null = null

  const sync = () => {
    const active = state.read('edgeRoutingPointDrag').active

    if (!active) {
      if (!offDragWindow) return
      offDragWindow()
      offDragWindow = null
      return
    }

    if (offDragWindow) return

    const handlePointerMove = (event: PointerEvent) => {
      const latest = state.read('edgeRoutingPointDrag').active
      if (!latest || latest.pointerId !== event.pointerId) return
      edgeCommands.updateRoutingPointDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const latest = state.read('edgeRoutingPointDrag').active
      if (!latest || latest.pointerId !== event.pointerId) return
      edgeCommands.endRoutingPointDrag({
        pointerId: event.pointerId
      })
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const latest = state.read('edgeRoutingPointDrag').active
      if (!latest || latest.pointerId !== event.pointerId) return
      edgeCommands.cancelRoutingPointDrag({
        pointerId: event.pointerId
      })
    }

    const offMove = events.onWindow('pointermove', handlePointerMove)
    const offUp = events.onWindow('pointerup', handlePointerUp)
    const offCancel = events.onWindow('pointercancel', handlePointerCancel)

    offDragWindow = () => {
      offMove()
      offUp()
      offCancel()
    }
  }

  const start = () => {
    if (offDragWatch) return
    offDragWatch = state.watch('edgeRoutingPointDrag', sync)
    sync()
  }

  const stop = () => {
    offDragWindow?.()
    offDragWindow = null
    offDragWatch?.()
    offDragWatch = null
  }

  return {
    start,
    sync,
    stop
  }
}
