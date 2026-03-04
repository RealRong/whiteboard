import type { ShortcutAction } from '../shortcuts/types'
import type { SelectionMode } from '../state/model'
import type {
  Commands,
  WriteDomain,
  WriteInput
} from '../command/api'
import type {
  NodeId,
  DispatchResult
} from '@whiteboard/core/types'

export type NodeCommandsApi = Commands['node']

export type EdgeCommandsApi = Commands['edge']

export type MindmapCommandsApi = Commands['mindmap']

export type SelectionCommandsApi = {
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

export type Apply = <D extends WriteDomain>(input: WriteInput<D>) => Promise<DispatchResult>

export type ShortcutActionDispatcher = {
  execute: (action: ShortcutAction) => boolean
}
