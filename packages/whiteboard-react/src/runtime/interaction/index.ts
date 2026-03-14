import type { InternalWhiteboardInstance } from '../types'
import { createEdgeConnectInteractionRuntime } from './edgeConnect'
import { createEdgeRoutingInteractionRuntime } from './edgeRouting'
import { createMindmapDragInteractionRuntime } from './mindmapDrag'
import { createNodeInteractionRuntime } from './node'
import { createSelectionInteractionRuntime } from './selection'
import { createSignal } from './signal'
import type {
  ActiveInteractionSessionKind,
  WhiteboardInteractionRuntime
} from './types'

export const createWhiteboardInteractionRuntime = (
  getInstance: () => InternalWhiteboardInstance
): WhiteboardInteractionRuntime => {
  const session = createSignal<{ kind: 'idle' | 'selection-box' | 'node-drag' | 'node-transform' | 'edge-connect' | 'edge-routing' }>({ kind: 'idle' })
  const lifecycle = {
    begin: (kind: ActiveInteractionSessionKind) => {
      session.set({ kind })
    },
    end: () => {
      session.set({ kind: 'idle' })
    }
  }
  const node = createNodeInteractionRuntime(getInstance, lifecycle)
  const selection = createSelectionInteractionRuntime(getInstance, lifecycle)
  const edgeConnect = createEdgeConnectInteractionRuntime(getInstance, lifecycle)
  const edgeRouting = createEdgeRoutingInteractionRuntime(getInstance, lifecycle)
  const mindmapDrag = createMindmapDragInteractionRuntime(getInstance)

  return {
    session,
    node,
    selection,
    edgeConnect,
    edgeRouting,
    mindmapDrag,
    clear: () => {
      node.cancel()
      selection.cancel()
      edgeConnect.cancel()
      edgeRouting.cancel()
      mindmapDrag.cancel()
    }
  }
}
