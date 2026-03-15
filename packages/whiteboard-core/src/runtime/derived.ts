import type {
  KeyedReadStore,
  ReadFn,
  ReadStore
} from './types'

type Dependency =
  | {
      kind: 'store'
      store: ReadStore<unknown>
    }
  | {
      kind: 'keyed'
      store: KeyedReadStore<unknown, unknown>
      key: unknown
    }

const isSameValue = <T,>(prev: T, next: T) => Object.is(prev, next)

const isSameDependency = (
  left: Dependency,
  right: Dependency
) => {
  if (left.kind !== right.kind || left.store !== right.store) {
    return false
  }

  if (left.kind === 'store') {
    return true
  }

  return right.kind === 'keyed' && Object.is(left.key, right.key)
}

const hasDependency = (
  dependencies: readonly Dependency[],
  target: Dependency
) => dependencies.some((dependency) => isSameDependency(dependency, target))

const areDependenciesEqual = (
  left: readonly Dependency[],
  right: readonly Dependency[]
) => {
  if (left.length !== right.length) {
    return false
  }

  return left.every((dependency) => hasDependency(right, dependency))
}

const addDependency = (
  dependencies: Dependency[],
  dependency: Dependency
) => {
  if (hasDependency(dependencies, dependency)) {
    return
  }
  dependencies.push(dependency)
}

export const createDerivedStore = <T,>({
  get,
  isEqual = isSameValue
}: {
  get: (read: ReadFn) => T
  isEqual?: (prev: T, next: T) => boolean
}): ReadStore<T> => {
  let value!: T
  let hasValue = false
  let computing = false
  let dependencies: Dependency[] = []
  let unsubscribeDependencies = () => {}
  let tracking = false
  const listeners = new Set<() => void>()

  const compute = () => {
    if (computing) {
      throw new Error('Circular derived store dependency detected.')
    }

    computing = true
    const nextDependencies: Dependency[] = []

    const read = ((store: ReadStore<unknown> | KeyedReadStore<unknown, unknown>, key?: unknown) => {
      if (key === undefined) {
        const dependency: Dependency = {
          kind: 'store',
          store: store as ReadStore<unknown>
        }
        addDependency(nextDependencies, dependency)
        return dependency.store.get()
      }

      const dependency: Dependency = {
        kind: 'keyed',
        store: store as KeyedReadStore<unknown, unknown>,
        key
      }
      addDependency(nextDependencies, dependency)
      return dependency.store.get(key)
    }) as ReadFn

    try {
      return {
        value: get(read),
        dependencies: nextDependencies
      }
    } finally {
      computing = false
    }
  }

  const bindDependencies = (nextDependencies: readonly Dependency[]) => {
    unsubscribeDependencies()
    unsubscribeDependencies = () => {}
    dependencies = [...nextDependencies]

    if (!tracking || nextDependencies.length === 0) {
      return
    }

    const unsubscribers = nextDependencies.map((dependency) => (
      dependency.kind === 'store'
        ? dependency.store.subscribe(handleDependencyChange)
        : dependency.store.subscribe(dependency.key, handleDependencyChange)
    ))

    unsubscribeDependencies = () => {
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe()
      })
    }
  }

  const handleDependencyChange = () => {
    const next = compute()
    const shouldRebind = !areDependenciesEqual(dependencies, next.dependencies)
    const changed = !hasValue || !isEqual(value, next.value)

    if (shouldRebind) {
      bindDependencies(next.dependencies)
    }

    if (!changed) {
      return
    }

    value = next.value
    hasValue = true
    Array.from(listeners).forEach((listener) => {
      listener()
    })
  }

  const refresh = () => {
    const next = compute()
    const shouldRebind = !areDependenciesEqual(dependencies, next.dependencies)

    if (shouldRebind) {
      bindDependencies(next.dependencies)
    }

    value = next.value
    hasValue = true
  }

  return {
    get: () => {
      if (!hasValue) {
        refresh()
      }
      return value
    },
    subscribe: (listener) => {
      listeners.add(listener)

      if (!tracking) {
        tracking = true
        const next = compute()
        bindDependencies(next.dependencies)
        value = next.value
        hasValue = true
      }

      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) {
          return
        }

        tracking = false
        unsubscribeDependencies()
        unsubscribeDependencies = () => {}
        dependencies = []
      }
    }
  }
}
