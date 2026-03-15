import { resolveEdgeEndpoints } from '@whiteboard/core/edge'
import type { EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { EdgeEntry } from '@whiteboard/engine'
import { useMemo, useRef, useSyncExternalStore } from 'react'
import {
  applyCanvasDraft,
  applyEdgeDraft,
  useTransientEdge,
  type EdgeDraft,
  type NodeDraft
} from '../../../runtime/draft'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'
import {
  useInternalInstance as useInstance,
  useSelection
} from '../../../runtime/hooks'

export type EdgeView = {
  edge: EdgeEntry['edge']
  endpoints: EdgeEntry['endpoints']
}

export type SelectedEdgeRoutingHandleView = {
  key: string
  edgeId: EdgeId
  index: number
  point: Point
  active: boolean
}

export type SelectedEdgeView = {
  edgeId: EdgeId
  endpoints: EdgeView['endpoints']
  routingHandles: readonly SelectedEdgeRoutingHandleView[]
}

type EdgeViewCacheEntry = {
  edgeId: EdgeId
  entry: EdgeEntry
  sourceDraft: NodeDraft
  targetDraft: NodeDraft
  edgeDraft: EdgeDraft
  view: EdgeView
}

const EMPTY_UNSUBSCRIBE = () => {}

const applyEndpointDrafts = (
  entry: EdgeEntry,
  instance: Pick<InternalWhiteboardInstance, 'read'>,
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
  instance: Pick<InternalWhiteboardInstance, 'read'>,
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

export const useEdgeView = (
  edgeId: EdgeId | undefined
) => {
  const instance = useInstance()
  const cacheRef = useRef<EdgeViewCacheEntry | null>(null)

  const subscribe = useMemo(
    () => {
      if (!edgeId) {
        return () => EMPTY_UNSUBSCRIBE
      }

      return (listener: () => void) => {
        const entry = instance.read.edge.byId.get(edgeId)
        if (!entry) {
          return instance.read.edge.byId.subscribe(edgeId, listener)
        }

        const unsubscribeEdge = instance.read.edge.byId.subscribe(edgeId, listener)
        const unsubscribeEdgeDraft = instance.draft.edge.subscribe(edgeId, listener)
        const unsubscribeSourceDraft = instance.draft.node.subscribe(entry.edge.source.nodeId, listener)
        const unsubscribeTargetDraft = instance.draft.node.subscribe(entry.edge.target.nodeId, listener)

        return () => {
          unsubscribeEdge()
          unsubscribeEdgeDraft()
          unsubscribeSourceDraft()
          unsubscribeTargetDraft()
        }
      }
    },
    [edgeId, instance]
  )

  const getSnapshot = useMemo(
    () => () => {
      if (!edgeId) {
        cacheRef.current = null
        return undefined
      }

      const entry = instance.read.edge.byId.get(edgeId)
      if (!entry) {
        cacheRef.current = null
        return undefined
      }

      const sourceDraft = instance.draft.node.get(entry.edge.source.nodeId)
      const targetDraft = instance.draft.node.get(entry.edge.target.nodeId)
      const edgeDraft = instance.draft.edge.get(edgeId)
      const cached = cacheRef.current

      if (
        cached
        && cached.edgeId === edgeId
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

      cacheRef.current = {
        edgeId,
        entry,
        sourceDraft,
        targetDraft,
        edgeDraft,
        view
      }

      return view
    },
    [edgeId, instance]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )
}

export const useSelectedEdgeView = (): SelectedEdgeView | undefined => {
  const instance = useInstance()
  const edgeId = useSelection().edgeId
  const entry = useEdgeView(edgeId)
  const draft = useTransientEdge(instance.draft.edge, edgeId)

  return useMemo(() => {
    if (!edgeId || !entry) return undefined
    const edge = entry.edge
    const points = edge.routing?.points ?? []
    const routingHandles =
      edge.type === 'bezier' || edge.type === 'curve'
        ? []
        : points.map((point, index) => ({
            key: `${edge.id}-point-${index}`,
            edgeId: edge.id,
            index,
            point,
            active: draft.activeRoutingIndex === index
          }))

    return {
      edgeId,
      endpoints: entry.endpoints,
      routingHandles
    }
  }, [draft.activeRoutingIndex, edgeId, entry])
}
