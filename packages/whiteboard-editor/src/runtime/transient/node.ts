import {
  createStagedKeyedStore,
  type KeyedReadStore,
  type StagedKeyedStore
} from '@whiteboard/engine'
import type { NodeProjectionPatch as CoreNodeProjectionPatch } from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'

export type NodePatch = CoreNodeProjectionPatch

export type NodePatchEntry = {
  id: NodeId
  patch: NodePatch
}

export type NodeTransientState = {
  patches: readonly NodePatchEntry[]
  hovered?: NodeId
  hidden: readonly NodeId[]
}

export type NodeTransientRuntime = {
  set: (
    next:
      | NodeTransientState
      | ((current: NodeTransientState) => NodeTransientState)
  ) => void
  clear: () => void
}

export type NodeTransientProjection = {
  patch?: NodePatch
  hovered: boolean
  hidden: boolean
}

export type NodeTransientReader =
  KeyedReadStore<NodeId, NodeTransientProjection>

type NodeTransientStore =
  Pick<StagedKeyedStore<NodeId, NodeTransientProjection, NodeTransientState>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

const NO_PENDING = Symbol('node-transient-no-pending')

const EMPTY_PATCHES: readonly NodePatchEntry[] = []
const EMPTY_HIDDEN: readonly NodeId[] = []

export const EMPTY_NODE_TRANSIENT: NodeTransientState = {
  patches: EMPTY_PATCHES,
  hidden: EMPTY_HIDDEN
}

const EMPTY_NODE_TRANSIENT_PROJECTION: NodeTransientProjection = {
  hovered: false,
  hidden: false
}

const EMPTY_NODE_TRANSIENT_MAP = new Map<NodeId, NodeTransientProjection>()

const isSameNodeTransientState = (
  left: NodeTransientState,
  right: NodeTransientState
) => (
  left.patches === right.patches
  && left.hovered === right.hovered
  && left.hidden === right.hidden
)

const normalizeNodeTransientState = (
  state: NodeTransientState
): NodeTransientState => {
  const patches = state.patches.length > 0
    ? state.patches
    : EMPTY_PATCHES
  const hidden = state.hidden.length > 0
    ? state.hidden
    : EMPTY_HIDDEN

  if (patches === EMPTY_PATCHES && hidden === EMPTY_HIDDEN && state.hovered === undefined) {
    return EMPTY_NODE_TRANSIENT
  }

  return {
    patches,
    hovered: state.hovered,
    hidden
  }
}

const toNodeTransientMap = (
  state: NodeTransientState
) => {
  if (
    state.patches.length === 0
    && state.hidden.length === 0
    && state.hovered === undefined
  ) {
    return EMPTY_NODE_TRANSIENT_MAP
  }

  const next = new Map<NodeId, NodeTransientProjection>()
  const hiddenSet = new Set(state.hidden)

  for (let index = 0; index < state.patches.length; index += 1) {
    const entry = state.patches[index]!
    next.set(entry.id, {
      patch: entry.patch,
      hovered: state.hovered === entry.id,
      hidden: hiddenSet.has(entry.id)
    })
  }

  if (state.hovered !== undefined && !next.has(state.hovered)) {
    next.set(state.hovered, {
      hovered: true,
      hidden: hiddenSet.has(state.hovered)
    })
  }

  for (let index = 0; index < state.hidden.length; index += 1) {
    const nodeId = state.hidden[index]!
    if (next.has(nodeId)) {
      continue
    }

    next.set(nodeId, {
      hovered: false,
      hidden: true
    })
  }

  return next
}

const createNodeTransientStore = (): NodeTransientStore => {
  let scheduled = false
  let token = 0

  const store = createStagedKeyedStore<NodeId, NodeTransientProjection, NodeTransientState>({
    schedule: () => {
      if (scheduled) {
        return
      }

      scheduled = true
      const currentToken = token + 1
      token = currentToken
      queueMicrotask(() => {
        if (!scheduled || currentToken !== token) {
          return
        }

        scheduled = false
        store.flush()
      })
    },
    emptyState: EMPTY_NODE_TRANSIENT_MAP,
    emptyValue: EMPTY_NODE_TRANSIENT_PROJECTION,
    build: toNodeTransientMap,
    isEqual: (left, right) => (
      left.patch === right.patch
      && left.hovered === right.hovered
      && left.hidden === right.hidden
    )
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    write: store.write,
    clear: () => {
      scheduled = false
      token += 1
      store.clear()
    },
    flush: store.flush
  }
}

export const createNodeTransient = (): {
  runtime: NodeTransientRuntime
  reader: NodeTransientReader
} => {
  const store = createNodeTransientStore()
  let current = EMPTY_NODE_TRANSIENT
  let pending: NodeTransientState | typeof NO_PENDING = NO_PENDING

  const commit = () => {
    if (pending === NO_PENDING) {
      return
    }

    current = pending
    pending = NO_PENDING
  }

  const scheduleSet = (
    next: NodeTransientState
  ) => {
    const normalized = normalizeNodeTransientState(next)
    const base = pending === NO_PENDING
      ? current
      : pending

    if (isSameNodeTransientState(base, normalized)) {
      return
    }

    pending = normalized
    store.write(normalized)

    queueMicrotask(commit)
  }

  return {
    runtime: {
      set: (next) => {
        const base = pending === NO_PENDING
          ? current
          : pending
        const resolved = typeof next === 'function'
          ? next(base)
          : next
        scheduleSet(resolved)
      },
      clear: () => {
        pending = NO_PENDING
        current = EMPTY_NODE_TRANSIENT
        store.clear()
      }
    },
    reader: {
      get: store.get,
      subscribe: store.subscribe
    }
  }
}
