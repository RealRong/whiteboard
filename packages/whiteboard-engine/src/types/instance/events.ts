import type { DocumentId, EdgeId, NodeId, Viewport } from '@whiteboard/core'
import type { AppliedChangeSummary } from '../command'
import type { MindmapLayoutConfig } from '../mindmap'
import type { HistoryState } from '../state'

export type InstanceEventMap = {
  'change.applied': AppliedChangeSummary
  'selection.changed': { nodeIds: NodeId[] }
  'edge.selection.changed': { edgeId?: EdgeId }
  'tool.changed': { tool: 'select' | 'edge' }
  'viewport.changed': { viewport: Viewport }
  'history.changed': { history: HistoryState }
  'mindmap.layout.changed': { layout: MindmapLayoutConfig }
  'doc.changed': {
    docId?: DocumentId
    operationTypes: string[]
    origin?: 'user' | 'system' | 'remote'
  }
}

export type EventUnsubscribe = () => void

export type InstanceEvents = {
  on: <K extends keyof InstanceEventMap>(
    type: K,
    listener: (payload: InstanceEventMap[K]) => void
  ) => EventUnsubscribe
  off: <K extends keyof InstanceEventMap>(
    type: K,
    listener: (payload: InstanceEventMap[K]) => void
  ) => void
}

export type InstanceEventEmitter = InstanceEvents & {
  emit: <K extends keyof InstanceEventMap>(
    type: K,
    payload: InstanceEventMap[K]
  ) => void
}
