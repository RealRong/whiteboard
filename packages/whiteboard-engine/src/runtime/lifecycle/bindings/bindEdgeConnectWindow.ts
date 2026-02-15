import type { WhiteboardInstance } from '@engine-types/instance'
import { createPointerSessionWindowBinding } from './bindPointerSessionWindow'

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
  return createPointerSessionWindowBinding({
    events,
    watch: (listener) => state.watch('edgeConnect', listener),
    getActive: () => {
      const current = state.read('edgeConnect')
      return current.isConnecting ? current : undefined
    },
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      edgeConnectCommands.updateToClient(event.clientX, event.clientY)
    },
    onPointerUp: (event) => {
      edgeConnectCommands.commitToClient(event.clientX, event.clientY)
    }
  })
}
