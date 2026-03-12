import type { InternalWhiteboardInstance } from '../common/instance/types'
import { createRafTask, type RafTask } from '../common/utils/rafTask'
import {
  createTransientConnection,
  type TransientConnection,
} from './connection'
import {
  createTransientEdge,
  type TransientEdge
} from './edge'
import {
  createTransientGuides,
  type TransientGuides
} from './guides'
import {
  createTransientNode,
  type TransientNode,
} from './node'
import {
  createTransientMindmap,
  type TransientMindmap
} from './mindmap'
import {
  createTransientSelection,
  type TransientSelection
} from './selection'

type UiStore = InternalWhiteboardInstance['uiStore']

export type Transient = {
  node: TransientNode
  guides: TransientGuides
  connection: TransientConnection
  edge: TransientEdge
  selection: TransientSelection
  mindmap: TransientMindmap
}

export const createTransient = (
  uiStore: UiStore
): Transient => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const { node, flush: flushNode } = createTransientNode(schedule)
  const { guides, flush: flushGuides } = createTransientGuides(uiStore, schedule)
  const { connection, flush: flushConnection } = createTransientConnection(schedule)
  const { edge, flush: flushEdge } = createTransientEdge(schedule)
  const { selection, flush: flushSelection } = createTransientSelection(schedule)
  const { mindmap, flush: flushMindmap } = createTransientMindmap(schedule)

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
    mindmap
  }
}
