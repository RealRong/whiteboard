import type { ShortcutAction } from '../shortcuts/types'
import type { SelectionMode } from '../state/model'
import type { Commands } from '../command/api'
import type {
  DispatchResult,
  Edge,
  EdgeId,
  NodeId,
  Point
} from '@whiteboard/core/types'

export type NodeCommandsApi = Commands['node'] & {
  createGroup: (ids: NodeId[]) => Promise<DispatchResult>
  ungroup: (id: NodeId) => Promise<DispatchResult>
  setOrder: (ids: NodeId[]) => Promise<DispatchResult>
  bringToFront: (ids: NodeId[]) => Promise<DispatchResult>
  sendToBack: (ids: NodeId[]) => Promise<DispatchResult>
  bringForward: (ids: NodeId[]) => Promise<DispatchResult>
  sendBackward: (ids: NodeId[]) => Promise<DispatchResult>
}

export type EdgeCommandsApi = Commands['edge'] & {
  insertRoutingPointAt: (edgeId: EdgeId, pointWorld: Point) => boolean
  removeRoutingPointAt: (edgeId: EdgeId, index: number) => boolean
  setOrder: (ids: EdgeId[]) => Promise<DispatchResult>
  bringToFront: (ids: EdgeId[]) => Promise<DispatchResult>
  sendToBack: (ids: EdgeId[]) => Promise<DispatchResult>
  bringForward: (ids: EdgeId[]) => Promise<DispatchResult>
  sendBackward: (ids: EdgeId[]) => Promise<DispatchResult>
}

export type MindmapCommandsApi = Commands['mindmap']

export type SelectionCommandsApi = {
  readonly name: 'Selection'
  getSelectedNodeIds: () => NodeId[]
  select: (ids: NodeId[], mode?: SelectionMode) => void
  toggle: (ids: NodeId[]) => void
  selectAll: () => void
  clear: () => void
  groupSelected: () => Promise<void>
  ungroupSelected: () => Promise<void>
  deleteSelected: () => Promise<void>
  duplicateSelected: () => Promise<void>
}

export type InteractionCommandsApi = Commands['interaction']

export type ViewportCommandsApi = Commands['viewport']

export type ShortcutActionDispatcher = {
  execute: (action: ShortcutAction) => boolean
}
