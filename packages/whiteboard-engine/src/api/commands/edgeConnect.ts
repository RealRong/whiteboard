import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { EdgeConnectSystem } from '../../domain/EdgeConnect'

export const createEdgeConnectCommands = (
  instance: Instance
): {
  edgeConnect: Commands['edgeConnect']
} => {
  const edgeConnectSystem = new EdgeConnectSystem(instance)

  return {
    edgeConnect: edgeConnectSystem.createCommands()
  }
}
