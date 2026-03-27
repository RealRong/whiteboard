import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import type { NodeId } from '@whiteboard/core/types'
import type {
  NodeSession,
  NodeSessionReader
} from '@whiteboard/editor'

export {
  clearNodeSessionHidden,
  clearNodeSessionPatch,
  clearNodeSessionPreview,
  createNodeFeatureRuntime,
  createNodeSessionStore,
  projectNodeItem,
  writeNodeSessionHidden,
  writeNodeSessionPatch,
  writeNodeSessionPreview
} from '@whiteboard/editor'
export type {
  NodeFeatureRuntime,
  NodePatch,
  NodeSession,
  NodeSessionReader,
  NodeSessionStore
} from '@whiteboard/editor'

const EMPTY_NODE_SESSION: NodeSession = {
  hovered: false,
  hidden: false
}

export const useNodeSession = (
  store: NodeSessionReader,
  nodeId: NodeId | undefined
) => useOptionalKeyedStoreValue(store, nodeId, EMPTY_NODE_SESSION)
