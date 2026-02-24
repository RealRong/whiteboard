import { getEdgePath } from '@whiteboard/core/edge'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
import type { EdgeConnectState } from '@engine-types/state'
import type { ReconnectPoint } from './types'

type Options = {
  resolveEndpoints: (edge: EdgePathEntry['edge']) => EdgeEndpoints | undefined
  resolveReconnectPoint: (to: EdgeConnectState['to']) => ReconnectPoint | undefined
}

export class Preview {
  constructor(private readonly options: Options) {}

  createReconnectEntry = (
    edgeConnect: EdgeConnectState,
    reconnectBase: EdgePathEntry
  ): EdgePathEntry | undefined => {
    const moved = this.options.resolveReconnectPoint(edgeConnect.to)
    if (!moved) return undefined

    const endpoints = this.options.resolveEndpoints(reconnectBase.edge)
    if (!endpoints) return undefined

    let source = {
      point: endpoints.source.point,
      side: endpoints.source.anchor.side
    }
    let target = {
      point: endpoints.target.point,
      side: endpoints.target.anchor.side
    }

    if (edgeConnect.reconnect?.end === 'source') {
      source = {
        point: moved.point,
        side: moved.side ?? source.side
      }
    } else {
      target = {
        point: moved.point,
        side: moved.side ?? target.side
      }
    }

    return {
      ...reconnectBase,
      path: getEdgePath({
        edge: reconnectBase.edge,
        source,
        target
      })
    }
  }
}
