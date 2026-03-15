import type { EdgeId, Point } from '@whiteboard/core/types'
import type { EdgeEntry } from '@whiteboard/core/read'
import { createKeyedDraftStore, useKeyedDraft } from './shared/keyedStore'

type EdgeDraftMap = ReadonlyMap<EdgeId, EdgeDraft>

export type EdgePatch = {
  routingPoints?: readonly Point[]
}

export type EdgePatchInput =
  EdgePatch & {
    id: EdgeId
    activeRoutingIndex?: number
  }

export type EdgeDraft = {
  patch?: EdgePatch
  activeRoutingIndex?: number
}

export type EdgeWriteInput = {
  patches: readonly EdgePatchInput[]
}

export type TransientEdge = {
  get: (edgeId: EdgeId) => EdgeDraft
  subscribe: (edgeId: EdgeId, listener: () => void) => () => void
  write: (next: EdgeWriteInput) => void
  clear: () => void
}

export type EdgeReader =
  Pick<TransientEdge, 'get' | 'subscribe'>

export type EdgeWriter =
  Pick<TransientEdge, 'write' | 'clear'>

export const EMPTY_EDGE_DRAFT: EdgeDraft = {}

const EMPTY_EDGE_MAP: EdgeDraftMap =
  new Map<EdgeId, EdgeDraft>()

const toEdgeDraftMap = ({
  patches
}: EdgeWriteInput): EdgeDraftMap => {
  if (!patches.length) {
    return EMPTY_EDGE_MAP
  }

  const next = new Map<EdgeId, EdgeDraft>()
  patches.forEach((patch) => {
    next.set(patch.id, {
      patch: patch.routingPoints
        ? {
          routingPoints: patch.routingPoints
        }
        : undefined,
      activeRoutingIndex: patch.activeRoutingIndex
    })
  })
  return next
}

const applyRoutingDraft = (
  edge: EdgeEntry['edge'],
  routingPoints: readonly Point[] | undefined
): EdgeEntry['edge'] => {
  if (!routingPoints || edge.type === 'bezier' || edge.type === 'curve') {
    return edge
  }

  const routing = edge.routing
  const points = routing?.points ?? []
  if (routingPoints === points) {
    return edge
  }

  return {
    ...edge,
    routing: {
      ...(routing ?? {}),
      mode: routing?.mode ?? 'manual',
      points: [...routingPoints]
    }
  }
}

export const applyEdgeDraft = (
  entry: EdgeEntry,
  draft: EdgeDraft
): EdgeEntry => {
  const edge = applyRoutingDraft(entry.edge, draft.patch?.routingPoints)
  if (edge === entry.edge) {
    return entry
  }

  return {
    ...entry,
    edge
  }
}

export const createTransientEdge = (
  schedule: () => void
) => {
  const { flush, ...edge } = createKeyedDraftStore({
    schedule,
    emptyState: EMPTY_EDGE_MAP,
    emptyValue: EMPTY_EDGE_DRAFT,
    build: toEdgeDraftMap,
    isEqual: (left, right) => (
      left.patch?.routingPoints === right.patch?.routingPoints
      && left.activeRoutingIndex === right.activeRoutingIndex
    )
  })

  return {
    edge,
    flush
  }
}

export const useTransientEdge = (
  edge: EdgeReader,
  edgeId: EdgeId | undefined
) => useKeyedDraft(edge, edgeId, EMPTY_EDGE_DRAFT)
