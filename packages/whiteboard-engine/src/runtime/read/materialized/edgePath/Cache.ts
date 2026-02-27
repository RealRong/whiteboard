import type { Edge, EdgeId } from '@whiteboard/core/types'
import type { EdgePathEntry } from '@engine-types/instance/read'
import type { EdgePathCacheEntry } from './types'

type Options = {
  toCacheEntry: (
    edge: EdgePathEntry['edge'],
    previous?: EdgePathCacheEntry
  ) => EdgePathCacheEntry | undefined
}

const isSameEntryList = (left: EdgePathEntry[], right: EdgePathEntry[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export class Cache {
  private entryById = new Map<EdgePathEntry['id'], EdgePathCacheEntry>()
  private entries: EdgePathEntry[] = []
  private ids: EdgeId[] = []
  private byId = new Map<EdgeId, EdgePathEntry>()

  constructor(private readonly options: Options) { }

  rebuild = (edges: EdgePathEntry['edge'][]) => {
    const previousMap = this.entryById
    const nextMap = new Map<EdgePathEntry['id'], EdgePathCacheEntry>()

    edges.forEach((edge) => {
      const nextEntry = this.options.toCacheEntry(edge, previousMap.get(edge.id))
      if (!nextEntry) return
      nextMap.set(edge.id, nextEntry)
    })

    this.entryById = nextMap
    this.syncEntryList(edges.map((edge) => edge.id), nextMap)
  }

  updateByEdgeIds = ({
    edgeIds,
    getEdge,
    orderIds
  }: {
    edgeIds: Iterable<EdgeId>
    getEdge: (edgeId: EdgeId) => Edge | undefined
    orderIds: readonly EdgeId[]
  }) => {
    let nextMap = this.entryById
    let changed = false

    for (const edgeId of edgeIds) {
      const edge = getEdge(edgeId)
      if (!edge) continue

      const previous = this.entryById.get(edgeId)
      const next = this.options.toCacheEntry(edge, previous)

      if (!next) {
        if (!previous) continue
        if (!changed) {
          nextMap = new Map(this.entryById)
          changed = true
        }
        nextMap.delete(edgeId)
        continue
      }

      if (previous === next) continue
      if (!changed) {
        nextMap = new Map(this.entryById)
        changed = true
      }
      nextMap.set(edgeId, next)
    }

    if (!changed) return

    this.entryById = nextMap
    this.syncEntryList(orderIds, nextMap)
  }

  getEntries = () => this.entries
  getIds = () => this.ids
  getById = () => this.byId

  getEntryById = (edgeId: EdgeId): EdgePathCacheEntry | undefined =>
    this.entryById.get(edgeId)

  private syncEntryList = (
    orderIds: readonly EdgeId[],
    byId: Map<EdgePathEntry['id'], EdgePathCacheEntry>
  ) => {
    const nextEntries = orderIds
      .map((edgeId) => byId.get(edgeId)?.entry)
      .filter((entry): entry is EdgePathEntry => Boolean(entry))

    if (isSameEntryList(this.entries, nextEntries)) return
    this.entries = nextEntries
    this.ids = nextEntries.map((e) => e.id)
    this.byId = new Map(nextEntries.map((e) => [e.id, e]))
  }
}
