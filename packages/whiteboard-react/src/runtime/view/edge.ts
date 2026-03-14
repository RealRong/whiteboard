import type { EdgeId } from '@whiteboard/core/types'
import { resolveEdgeEndpoints } from '@whiteboard/core/edge'
import type { EdgeEntry } from '@whiteboard/engine'
import type { InternalWhiteboardInstance } from '../instance/types'
import type { KeyedView } from './types'
import {
  applyCanvasDraft,
  applyEdgeDraft,
  type EdgeDraft,
  type NodeDraft
} from '../draft'

const applyNodeDraft = (
  entry: EdgeEntry,
  instance: Pick<InternalWhiteboardInstance, 'read'>,
  sourceDraft: NodeDraft,
  targetDraft: NodeDraft
) => {
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

  return {
    ...entry,
    endpoints
  }
}

export type EdgeView = EdgeEntry

export const readEdgeView = (
  instance: InternalWhiteboardInstance,
  edgeId: EdgeId | undefined
): EdgeView | undefined => {
  if (!edgeId) return undefined

  const entry = instance.read.edge.get(edgeId)
  if (!entry) return undefined

  return applyEdgeDraft(
    applyNodeDraft(
      entry,
      instance,
      instance.draft.node.get(entry.edge.source.nodeId),
      instance.draft.node.get(entry.edge.target.nodeId)
    ),
    instance.draft.edge.get(edgeId)
  )
}

export const createEdgeView = (
  getInstance: () => InternalWhiteboardInstance
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
      const instance = getInstance()
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

      const view = readEdgeView(instance, edgeId)
      if (!view) {
        cacheByEdgeId.delete(edgeId)
        return undefined
      }

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
      const instance = getInstance()
      if (!edgeId) return () => {}

      const entry = instance.read.edge.get(edgeId)
      if (!entry) {
        return instance.read.edge.subscribe(edgeId, listener)
      }

      const unsubscribers = [
        instance.read.edge.subscribe(edgeId, listener),
        instance.draft.edge.subscribe(edgeId, listener),
        instance.draft.node.subscribe(entry.edge.source.nodeId, listener),
        instance.draft.node.subscribe(entry.edge.target.nodeId, listener)
      ]

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    }
  }
}
