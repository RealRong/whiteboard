import { createRafTask, type RafTask } from '../utils/rafTask'
import {
  createConnectionDraftStore,
  type ConnectionDraftStore,
} from './connection'
import {
  createEdgeDraftStore,
  type EdgeDraftStore
} from './edge'
import {
  createGuidesDraftStore,
  type GuidesDraftStore
} from './guides'
import {
  createNodeDraftStore,
  type NodeDraftStore,
} from './node'
import {
  createMindmapDraftStore,
  type MindmapDraftStore
} from './mindmap'
import {
  createSelectionDraftStore,
  type SelectionDraftStore
} from './selection'

export type Drafts = {
  node: NodeDraftStore
  guides: GuidesDraftStore
  connection: ConnectionDraftStore
  edge: EdgeDraftStore
  selection: SelectionDraftStore
  mindmap: MindmapDraftStore
  clear: () => void
}

export const createDrafts = (): Drafts => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const { node, flush: flushNode } = createNodeDraftStore(schedule)
  const { guides, flush: flushGuides } = createGuidesDraftStore(schedule)
  const { connection, flush: flushConnection } = createConnectionDraftStore(schedule)
  const { edge, flush: flushEdge } = createEdgeDraftStore(schedule)
  const { selection, flush: flushSelection } = createSelectionDraftStore(schedule)
  const { mindmap, flush: flushMindmap } = createMindmapDraftStore(schedule)

  flushAll.push(
    flushGuides,
    flushNode,
    flushConnection,
    flushEdge,
    flushSelection,
    flushMindmap
  )

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    node,
    guides,
    connection,
    edge,
    selection,
    mindmap,
    clear: () => {
      task.cancel()
      node.clear()
      guides.clear()
      connection.clear()
      edge.clear()
      selection.clear()
      mindmap.clear()
    }
  }
}
