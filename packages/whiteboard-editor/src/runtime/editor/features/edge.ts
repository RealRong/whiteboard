import { createEdgeConnectInteraction } from '../../../features/edge/connect/interaction'
import { createEdgeEditInteraction } from '../../../features/edge/edit/interaction'
import { createEdgeHoverProcessor } from '../../../features/edge/hoverProcessor'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createEdgeFeature = (
  ctx: EditorFeatureContext
 ) => {
  const edgeConnect = createEdgeConnectInteraction(ctx)
  const edgeEdit = createEdgeEditInteraction(
    ctx,
    edgeConnect
  )
  const edgeHover = createEdgeHoverProcessor(ctx)

  return {
    interactions: [
      edgeConnect.create,
      edgeConnect.reconnect,
      edgeEdit.route,
      edgeEdit.body
    ],
    passive: [edgeHover],
    clear: edgeEdit.clear
  }
}
