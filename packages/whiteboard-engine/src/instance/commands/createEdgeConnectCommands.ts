import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance } from '@engine-types/instance'
import { EdgeConnectSystem } from '../edge/EdgeConnectSystem'

export const createEdgeConnectCommands = (
  instance: WhiteboardInstance
): {
  edgeConnect: WhiteboardCommands['edgeConnect']
} => {
  const edgeConnectSystem = new EdgeConnectSystem(instance)

  return {
    edgeConnect: edgeConnectSystem.createCommands()
  }
}
