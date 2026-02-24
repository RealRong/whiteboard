import type { Guide } from '@engine-types/node/snap'
import type { NodeViewUpdate } from '@engine-types/projection'
import type {
  NodeDragPayload,
  NodeTransformPayload,
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
  groupHovered?: NodeId | undefined
  mode?: SelectionMode
}

export type InteractionPatch = {
  kind: 'nodeDrag' | 'nodeTransform'
  pointerId: number | null
}

export type NodePayloadPatch = {
  drag?: NodeDragPayload | null
  transform?: NodeTransformPayload | null
}

export type RuntimeOutput = {
  frame?: boolean
  selection?: SelectionPatch
  interaction?: InteractionPatch
  nodePayload?: NodePayloadPatch
  guides?: Guide[]
  overrideUpdates?: NodeViewUpdate[]
  clearOverrideIds?: NodeId[]
  clearAllOverrides?: boolean
  mutations?: Operation[]
}

export type NodeDragRuntimeOutput = RuntimeOutput
export type NodeTransformRuntimeOutput = RuntimeOutput
