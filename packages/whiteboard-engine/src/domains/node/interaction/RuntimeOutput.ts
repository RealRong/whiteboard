import type { Guide } from '@engine-types/node/snap'
import type {
  NodePreviewUpdate,
  NodeDragPayload,
  SelectionMode
} from '@engine-types/state'
import type {
  EdgeId,
  NodeId,
  Operation
} from '@whiteboard/core/types'

export type SelectionPatch = {
  selectedNodeIds?: Set<NodeId>
  selectedEdgeId?: EdgeId | undefined
  mode?: SelectionMode
}

export type InteractionPatch = {
  kind: 'nodeDrag' | 'nodeTransform'
  pointerId: number | null
}

export type NodePayloadPatch = {
  drag?: NodeDragPayload | null
}

export type RuntimeOutput = {
  frame?: boolean
  clearInteractions?: readonly InteractionPatch['kind'][]
  selection?: SelectionPatch
  groupHover?: NodeId | undefined
  interaction?: InteractionPatch
  nodePayload?: NodePayloadPatch
  nodePreview?: NodePreviewUpdate[]
  guides?: Guide[]
  mutations?: Operation[]
}

export type NodeDragRuntimeOutput = RuntimeOutput
export type NodeTransformRuntimeOutput = RuntimeOutput
