import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { resolveEdgeEndpoints } from '@whiteboard/core/edge'
import type { EdgeEntry } from '@whiteboard/engine'
import type { WhiteboardRead } from '../instance/types'
import { combineUnsubscribers } from './shared'
import type { KeyedView } from './types'
import {
  applyCanvasDraft,
  applyEdgeDraft,
  type EdgeDraft,
  type NodeDraft
} from '../draft'

type EdgeViewContext = {
  read: WhiteboardRead
  draft: {
    edge: {
      get: (edgeId: EdgeId) => EdgeDraft
      subscribe: (edgeId: EdgeId, listener: () => void) => () => void
    }
    node: {
      get: (nodeId: NodeId) => NodeDraft
      subscribe: (nodeId: NodeId, listener: () => void) => () => void
    }
  }
}

const applyEndpointDrafts = (
  entry: EdgeEntry,
  instance: Pick<EdgeViewContext, 'read'>,
  sourceDraft: NodeDraft,
  targetDraft: NodeDraft
) : EdgeEntry => {
  if (!sourceDraft.patch && !targetDraft.patch) {
    return entry
  }

  const sourceEntry = instance.read.index.node.byId(entry.edge.source.nodeId)
  const targetEntry = instance.read.index.node.byId(entry.edge.target.nodeId)
  if (!sourceEntry || !targetEntry) {
    return entry
  }

  const source = applyCanvasDraft(sourceEntry, sourceDraft)
  const target = applyCanvasDraft(targetEntry, targetDraft)
  const endpoints = resolveEdgeEndpoints({
    edge: entry.edge,
    source,
    target
  })

  if (endpoints === entry.endpoints) {
    return entry
  }

  return {
    ...entry,
    endpoints
  }
}

const resolveEdgeView = (
  instance: EdgeViewContext,
  entry: EdgeEntry,
  sourceDraft: NodeDraft,
  targetDraft: NodeDraft,
  edgeDraft: EdgeDraft
): EdgeView => {
  const resolved = applyEdgeDraft(applyEndpointDrafts(
    entry,
    instance,
    sourceDraft,
    targetDraft
  ), edgeDraft)

  return {
    edge: resolved.edge,
    endpoints: resolved.endpoints
  }
}

export type EdgeView = {
  edge: EdgeEntry['edge']
  endpoints: EdgeEntry['endpoints']
}

export const readEdgeView = (
  instance: EdgeViewContext,
  edgeId: EdgeId | undefined
): EdgeView | undefined => {
  if (!edgeId) return undefined

  const entry = instance.read.edge.get(edgeId)
  if (!entry) return undefined

  return resolveEdgeView(
    instance,
    entry,
    instance.draft.node.get(entry.edge.source.nodeId),
    instance.draft.node.get(entry.edge.target.nodeId),
    instance.draft.edge.get(edgeId)
  )
}

export const createEdgeView = (
  instance: EdgeViewContext
): KeyedView<EdgeId | undefined, EdgeView | undefined> => {
  const cacheByEdgeId = new Map<EdgeId, {
    entry: EdgeEntry
    sourceDraft: NodeDraft
    targetDraft: NodeDraft
    edgeDraft: EdgeDraft
    view: EdgeView
  }>()

  return {
    get: (edgeId) => {
      if (!edgeId) return undefined

      const entry = instance.read.edge.get(edgeId)
      if (!entry) {
        cacheByEdgeId.delete(edgeId)
        return undefined
      }

      const sourceDraft = instance.draft.node.get(entry.edge.source.nodeId)
      const targetDraft = instance.draft.node.get(entry.edge.target.nodeId)
      const edgeDraft = instance.draft.edge.get(edgeId)
      const cached = cacheByEdgeId.get(edgeId)

      if (
        cached
        && cached.entry === entry
        && cached.sourceDraft === sourceDraft
        && cached.targetDraft === targetDraft
        && cached.edgeDraft === edgeDraft
      ) {
        return cached.view
      }

      const view = resolveEdgeView(
        instance,
        entry,
        sourceDraft,
        targetDraft,
        edgeDraft
      )

      cacheByEdgeId.set(edgeId, {
        entry,
        sourceDraft,
        targetDraft,
        edgeDraft,
        view
      })
      return view
    },
    subscribe: (edgeId, listener) => {
      if (!edgeId) return () => {}

      const entry = instance.read.edge.get(edgeId)
      if (!entry) {
        return instance.read.edge.subscribe(edgeId, listener)
      }

      return combineUnsubscribers([
        instance.read.edge.subscribe(edgeId, listener),
        instance.draft.edge.subscribe(edgeId, listener),
        instance.draft.node.subscribe(entry.edge.source.nodeId, listener),
        instance.draft.node.subscribe(entry.edge.target.nodeId, listener)
      ])
    }
  }
}
