import type { WhiteboardInstance } from '@engine-types/instance'

type Options = {
  state: WhiteboardInstance['state']
  events: WhiteboardInstance['runtime']['events']
  edgeConnectCommands: Pick<WhiteboardInstance['commands']['edgeConnect'], 'updateToClient' | 'commitToClient'>
}

export type EdgeConnectWindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createEdgeConnectWindowBinding = ({
  state,
  events,
  edgeConnectCommands
}: Options): EdgeConnectWindowBinding => {
  let offEdgeConnectWatch: (() => void) | null = null
  let offEdgeConnectWindow: (() => void) | null = null

  const sync = () => {
    const current = state.read('edgeConnect')

    if (!current.isConnecting) {
      if (!offEdgeConnectWindow) return
      offEdgeConnectWindow()
      offEdgeConnectWindow = null
      return
    }

    if (offEdgeConnectWindow) return

    const handlePointerMove = (event: PointerEvent) => {
      const latest = state.read('edgeConnect')
      if (!latest.isConnecting) return
      if (latest.pointerId !== undefined && latest.pointerId !== null && event.pointerId !== latest.pointerId) return
      edgeConnectCommands.updateToClient(event.clientX, event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      const latest = state.read('edgeConnect')
      if (!latest.isConnecting) return
      if (latest.pointerId !== undefined && latest.pointerId !== null && event.pointerId !== latest.pointerId) return
      edgeConnectCommands.commitToClient(event.clientX, event.clientY)
    }

    const offMove = events.onWindow('pointermove', handlePointerMove)
    const offUp = events.onWindow('pointerup', handlePointerUp)

    offEdgeConnectWindow = () => {
      offMove()
      offUp()
    }
  }

  const start = () => {
    if (offEdgeConnectWatch) return
    offEdgeConnectWatch = state.watch('edgeConnect', sync)
    sync()
  }

  const stop = () => {
    offEdgeConnectWindow?.()
    offEdgeConnectWindow = null
    offEdgeConnectWatch?.()
    offEdgeConnectWatch = null
  }

  return {
    start,
    sync,
    stop
  }
}
