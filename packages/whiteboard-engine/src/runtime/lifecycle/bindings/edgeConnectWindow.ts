import type { Instance } from '@engine-types/instance'
import { createPointerSession } from './bindPointerSessionWindow'

type Options = {
  state: Instance['state']
  events: Instance['runtime']['events']
  edgeConnectCommands: Pick<Instance['commands']['edgeConnect'], 'updateToClient' | 'commitToClient'>
}

export type EdgeConnectBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createEdgeConnect = ({
  state,
  events,
  edgeConnectCommands
}: Options): EdgeConnectBinding => {
  return createPointerSession({
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
