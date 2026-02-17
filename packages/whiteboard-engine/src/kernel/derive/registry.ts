import { RevisionStore } from '../store'

type DeriveResolver<TKey extends string, TDependencyKey extends string, TSnapshot extends Record<TKey, unknown>> = {
  deps: TDependencyKey[]
  derive: () => TSnapshot[TKey]
}

type DeriveResolverMap<TKey extends string, TDependencyKey extends string, TSnapshot extends Record<TKey, unknown>> = {
  [K in TKey]: DeriveResolver<K, TDependencyKey, TSnapshot>
}

type DeriveMetrics = {
  recomputeCount: number
  cacheHitCount: number
  cacheMissCount: number
  totalComputeMs: number
  maxComputeMs: number
  lastComputeMs: number
  lastComputedAt?: number
}

type DeriveCacheEntry<TValue> = {
  value?: TValue
  hasValue: boolean
  dirty: boolean
  revision: number
  dependencySignature?: string
  metrics: DeriveMetrics
}

type DerivedRegistryDebugMetric = {
  revision: number
  dirty: boolean
  recomputeCount: number
  cacheHitCount: number
  cacheMissCount: number
  cacheHitRate: number
  lastComputeMs: number
  avgComputeMs: number
  maxComputeMs: number
  totalComputeMs: number
  lastComputedAt?: number
}

type Options<
  TKey extends string,
  TDependencyKey extends string,
  TSnapshot extends Record<TKey, unknown>
> = {
  keys: TKey[]
  resolvers: DeriveResolverMap<TKey, TDependencyKey, TSnapshot>
  watchDependency: (key: TDependencyKey, listener: () => void) => () => void
  project?: (
    keys: TKey[],
    read: <K extends TKey>(key: K) => TSnapshot[K]
  ) => void
}

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now())

const createEmptyMetrics = (): DeriveMetrics => ({
  recomputeCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  totalComputeMs: 0,
  maxComputeMs: 0,
  lastComputeMs: 0,
  lastComputedAt: undefined
})

const toDebugMetric = (entry: DeriveCacheEntry<unknown>): DerivedRegistryDebugMetric => {
  const { metrics } = entry
  const totalReads = metrics.cacheHitCount + metrics.cacheMissCount
  return {
    revision: entry.revision,
    dirty: entry.dirty,
    recomputeCount: metrics.recomputeCount,
    cacheHitCount: metrics.cacheHitCount,
    cacheMissCount: metrics.cacheMissCount,
    cacheHitRate: totalReads > 0 ? metrics.cacheHitCount / totalReads : 1,
    lastComputeMs: metrics.lastComputeMs,
    avgComputeMs: metrics.recomputeCount > 0 ? metrics.totalComputeMs / metrics.recomputeCount : 0,
    maxComputeMs: metrics.maxComputeMs,
    totalComputeMs: metrics.totalComputeMs,
    lastComputedAt: metrics.lastComputedAt
  }
}

export const createDerivedRegistry = <
  TKey extends string,
  TDependencyKey extends string,
  TSnapshot extends Record<TKey, unknown>
>({
  keys,
  resolvers,
  watchDependency,
  project
}: Options<TKey, TDependencyKey, TSnapshot>) => {
  const uniqueKeys = Array.from(new Set(keys))
  const dependencyRevisions = new RevisionStore<TDependencyKey>()
  const listeners = new Map<TKey, Set<() => void>>()
  const entries = new Map<TKey, DeriveCacheEntry<unknown>>(
    uniqueKeys.map((key) => [
      key,
      {
        hasValue: false,
        dirty: true,
        revision: 0,
        dependencySignature: undefined,
        metrics: createEmptyMetrics()
      }
    ])
  )

  const dependencyToKeys = new Map<TDependencyKey, Set<TKey>>()
  uniqueKeys.forEach((key) => {
    resolvers[key].deps.forEach((dependencyKey) => {
      let keySet = dependencyToKeys.get(dependencyKey)
      if (!keySet) {
        keySet = new Set<TKey>()
        dependencyToKeys.set(dependencyKey, keySet)
      }
      keySet.add(key)
    })
  })

  const notifyKey = (key: TKey) => {
    const keyListeners = listeners.get(key)
    if (!keyListeners?.size) return
    keyListeners.forEach((listener) => listener())
  }

  const markKeyDirty = (key: TKey) => {
    const entry = entries.get(key)
    if (!entry) return false
    if (entry.dirty) return false
    entry.dirty = true
    return true
  }

  const getDependencySignature = (key: TKey) =>
    dependencyRevisions.signature(resolvers[key].deps)

  const dependencyUnsubs = Array.from(dependencyToKeys.entries()).map(([dependencyKey, affectedKeys]) =>
    watchDependency(dependencyKey, () => {
      dependencyRevisions.bump(dependencyKey)
      const changedKeys: TKey[] = []
      affectedKeys.forEach((key) => {
        if (markKeyDirty(key)) {
          changedKeys.push(key)
        }
      })
      if (!changedKeys.length) return

      if (project) {
        project(changedKeys, read)
      }

      changedKeys.forEach((key) => {
        notifyKey(key)
      })
    })
  )

  const read = (<K extends TKey>(key: K): TSnapshot[K] => {
    const entry = entries.get(key)
    if (!entry) {
      throw new Error(`Unknown derived key: ${key}`)
    }

    if (!entry.dirty && entry.hasValue) {
      entry.metrics.cacheHitCount += 1
      return entry.value as TSnapshot[K]
    }

    const dependencySignature = getDependencySignature(key)
    if (entry.hasValue && entry.dependencySignature === dependencySignature) {
      entry.dirty = false
      entry.metrics.cacheHitCount += 1
      return entry.value as TSnapshot[K]
    }

    const start = now()
    const value = resolvers[key].derive()
    const elapsed = now() - start

    entry.metrics.recomputeCount += 1
    entry.metrics.cacheMissCount += 1
    entry.metrics.totalComputeMs += elapsed
    entry.metrics.maxComputeMs = Math.max(entry.metrics.maxComputeMs, elapsed)
    entry.metrics.lastComputeMs = elapsed
    entry.metrics.lastComputedAt = Date.now()

    const valueChanged = !entry.hasValue || !Object.is(entry.value, value)
    if (valueChanged) {
      entry.revision += 1
    }

    entry.value = value
    entry.hasValue = true
    entry.dirty = false
    entry.dependencySignature = dependencySignature
    return value
  }) as <K extends TKey>(key: K) => TSnapshot[K]

  const watch = (key: TKey, listener: () => void) => {
    let keyListeners = listeners.get(key)
    if (!keyListeners) {
      keyListeners = new Set()
      listeners.set(key, keyListeners)
    }
    keyListeners.add(listener)
    return () => {
      const current = listeners.get(key)
      if (!current) return
      current.delete(listener)
      if (!current.size) {
        listeners.delete(key)
      }
    }
  }

  const snapshot = () => Object.fromEntries(uniqueKeys.map((key) => [key, read(key)])) as TSnapshot

  const getMetric = (key: TKey) => {
    const entry = entries.get(key)
    if (!entry) {
      throw new Error(`Unknown derived key: ${key}`)
    }
    return toDebugMetric(entry)
  }

  const getAllMetrics = () =>
    Object.fromEntries(uniqueKeys.map((key) => [key, getMetric(key)])) as Record<TKey, DerivedRegistryDebugMetric>

  const resetMetrics = (key?: TKey) => {
    if (key) {
      const entry = entries.get(key)
      if (!entry) return
      entry.metrics = createEmptyMetrics()
      return
    }
    uniqueKeys.forEach((viewKey) => {
      const entry = entries.get(viewKey)
      if (!entry) return
      entry.metrics = createEmptyMetrics()
    })
  }

  const dispose = () => {
    dependencyUnsubs.forEach((off) => off())
    listeners.clear()
  }

  return {
    read,
    watch,
    snapshot,
    debug: {
      getMetric,
      getAllMetrics,
      resetMetrics
    },
    dispose
  }
}
