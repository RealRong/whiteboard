import { useMemo, useSyncExternalStore } from 'react'
import type { EdgeId, Point } from '@whiteboard/core/types'
import type { EdgeEntry } from '@whiteboard/engine'

type EdgeListener = () => void
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

export const applyEdgeDraft = (
  entry: EdgeEntry,
  draft: EdgeDraft
): EdgeEntry => {
  const edge = entry.edge
  const routingPoints = draft.patch?.routingPoints
  if (!routingPoints || edge.type === 'bezier' || edge.type === 'curve') return entry

  const points = edge.routing?.points ?? []
  if (routingPoints === points) return entry

  return {
    ...entry,
    edge: {
      ...edge,
      routing: {
        ...(edge.routing ?? {}),
        mode: edge.routing?.mode ?? 'manual',
        points: [...routingPoints]
      }
    }
  }
}

export const createTransientEdge = (
  schedule: () => void
) => {
  let current = EMPTY_EDGE_MAP
  let pending: EdgeWriteInput | undefined
  const listenersById = new Map<EdgeId, Set<EdgeListener>>()

  const commit = (next: EdgeDraftMap) => {
    const prev = current
    if (prev === next) return

    current = next

    const changedEdgeIds = new Set<EdgeId>()
    prev.forEach((_, edgeId) => {
      changedEdgeIds.add(edgeId)
    })
    next.forEach((_, edgeId) => {
      changedEdgeIds.add(edgeId)
    })

    changedEdgeIds.forEach((edgeId) => {
      const prevDraft = prev.get(edgeId) ?? EMPTY_EDGE_DRAFT
      const nextDraft = next.get(edgeId) ?? EMPTY_EDGE_DRAFT
      if (
        prevDraft.patch?.routingPoints === nextDraft.patch?.routingPoints
        && prevDraft.activeRoutingIndex === nextDraft.activeRoutingIndex
      ) {
        return
      }
      const listeners = listenersById.get(edgeId)
      if (!listeners?.size) return
      listeners.forEach((listener) => {
        listener()
      })
    })
  }

  const edge: TransientEdge = {
    get: (edgeId) => current.get(edgeId) ?? EMPTY_EDGE_DRAFT,
    subscribe: (edgeId, listener) => {
      let listeners = listenersById.get(edgeId)
      if (!listeners) {
        listeners = new Set<EdgeListener>()
        listenersById.set(edgeId, listeners)
      }
      listeners.add(listener)

      return () => {
        const currentListeners = listenersById.get(edgeId)
        if (!currentListeners) return
        currentListeners.delete(listener)
        if (!currentListeners.size) {
          listenersById.delete(edgeId)
        }
      }
    },
    write: (next) => {
      pending = next
      schedule()
    },
    clear: () => {
      pending = undefined
      if (current === EMPTY_EDGE_MAP) return
      commit(EMPTY_EDGE_MAP)
    }
  }

  return {
    edge,
    flush: () => {
      if (pending === undefined) return
      const next = pending
      pending = undefined
      commit(toEdgeDraftMap(next))
    }
  }
}

export const useTransientEdge = (
  edge: EdgeReader,
  edgeId: EdgeId | undefined
) => {
  const subscribe = useMemo(
    () => (listener: () => void) => {
      if (!edgeId) return () => {}
      return edge.subscribe(edgeId, listener)
    },
    [edge, edgeId]
  )
  const getSnapshot = useMemo(
    () => () => {
      if (!edgeId) return EMPTY_EDGE_DRAFT
      return edge.get(edgeId)
    },
    [edge, edgeId]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_EDGE_DRAFT
  )
}
