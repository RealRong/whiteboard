import type {
  Commands,
  WriteDomain,
  WriteInput
} from '../command/api'
import type {
  DispatchResult
} from '@whiteboard/core/types'

export type NodeCommandsApi = Commands['node']

export type EdgeCommandsApi = Commands['edge']

export type MindmapCommandsApi = Commands['mindmap']

export type ViewportCommandsApi = Commands['viewport']

export type Apply = <D extends WriteDomain>(input: WriteInput<D>) => Promise<DispatchResult>
