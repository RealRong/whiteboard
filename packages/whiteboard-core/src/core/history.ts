import type { ChangeHandlers } from './changes'
import type { Operation, CoreHistoryConfig, CoreHistoryState, DispatchResult, Origin } from '../types/core'

type HistoryEntry = {
  forward: Operation[]
  inverse: Operation[]
  timestamp: number
  origin?: Origin
  source: 'single' | 'transaction'
}

type HistoryCollectorState = {
  isApplying: boolean
  undo: HistoryEntry[]
  redo: HistoryEntry[]
  txDepth: number
  txDiscard: boolean
  txForward: Operation[]
  txInverse: Operation[]
  txOrigin?: Origin
  txTimestamp?: number
}

type CreateCoreHistoryDeps = {
  changes: ChangeHandlers
  now: () => number
  applyOperations: (operations: Operation[], origin?: Origin) => DispatchResult
}

const DEFAULT_HISTORY_CONFIG: CoreHistoryConfig = {
  enabled: true,
  capacity: 100,
  captureSystem: true,
  captureRemote: false
}

const cloneValue = <T,>(value: T): T => {
  const structuredCloneFn = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (structuredCloneFn) {
    return structuredCloneFn(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const cloneOperations = (operations: Operation[]) => cloneValue(operations)

const createStateSnapshot = (collector: HistoryCollectorState, now: () => number): CoreHistoryState => ({
  canUndo: collector.undo.length > 0,
  canRedo: collector.redo.length > 0,
  undoDepth: collector.undo.length,
  redoDepth: collector.redo.length,
  isApplying: collector.isApplying,
  lastUpdatedAt: now()
})

const invertOperation = (operation: Operation): Operation[] | null => {
  switch (operation.type) {
    case 'node.create': {
      return [
        {
          type: 'node.delete',
          id: operation.node.id,
          before: cloneValue(operation.node)
        }
      ]
    }
    case 'node.update': {
      if (!operation.before) return null
      return [
        {
          type: 'node.update',
          id: operation.id,
          patch: cloneValue(operation.before) as any
        }
      ]
    }
    case 'node.delete': {
      if (!operation.before) return null
      return [
        {
          type: 'node.create',
          node: cloneValue(operation.before)
        }
      ]
    }
    case 'node.order.set':
    case 'node.order.bringToFront':
    case 'node.order.sendToBack':
    case 'node.order.bringForward':
    case 'node.order.sendBackward': {
      if (!operation.before) return null
      return [
        {
          type: 'node.order.set',
          ids: [...operation.before]
        }
      ]
    }
    case 'edge.create': {
      return [
        {
          type: 'edge.delete',
          id: operation.edge.id,
          before: cloneValue(operation.edge)
        }
      ]
    }
    case 'edge.update': {
      if (!operation.before) return null
      return [
        {
          type: 'edge.update',
          id: operation.id,
          patch: cloneValue(operation.before) as any
        }
      ]
    }
    case 'edge.delete': {
      if (!operation.before) return null
      return [
        {
          type: 'edge.create',
          edge: cloneValue(operation.before)
        }
      ]
    }
    case 'edge.order.set':
    case 'edge.order.bringToFront':
    case 'edge.order.sendToBack':
    case 'edge.order.bringForward':
    case 'edge.order.sendBackward': {
      if (!operation.before) return null
      return [
        {
          type: 'edge.order.set',
          ids: [...operation.before]
        }
      ]
    }
    case 'mindmap.create': {
      return [
        {
          type: 'mindmap.delete',
          id: operation.mindmap.id,
          before: cloneValue(operation.mindmap)
        }
      ]
    }
    case 'mindmap.replace': {
      if (!operation.before) return null
      return [
        {
          type: 'mindmap.replace',
          id: operation.id,
          before: cloneValue(operation.after),
          after: cloneValue(operation.before)
        }
      ]
    }
    case 'mindmap.delete': {
      if (!operation.before) return null
      return [
        {
          type: 'mindmap.create',
          mindmap: cloneValue(operation.before)
        }
      ]
    }
    case 'mindmap.node.create': {
      return [
        {
          type: 'mindmap.node.delete',
          id: operation.id,
          nodeId: operation.node.id,
          parentId: operation.parentId,
          index: operation.index,
          subtree: {
            nodes: {
              [operation.node.id]: cloneValue(operation.node)
            },
            children: {
              [operation.node.id]: []
            }
          }
        }
      ]
    }
    case 'mindmap.node.update': {
      if (!operation.before) return null
      return [
        {
          type: 'mindmap.node.update',
          id: operation.id,
          nodeId: operation.nodeId,
          patch: cloneValue(operation.before)
        }
      ]
    }
    case 'mindmap.node.delete': {
      if (!operation.parentId) return null
      const queue: string[] = [operation.nodeId]
      const createOps: Operation[] = []
      while (queue.length) {
        const nodeId = queue.shift() as string
        const node = operation.subtree.nodes[nodeId]
        if (!node) continue
        const parentId =
          nodeId === operation.nodeId ? operation.parentId : node.parentId
        if (!parentId) return null

        const parentChildren = operation.subtree.children[parentId] ?? []
        const childIndex = parentChildren.indexOf(nodeId)
        const index =
          nodeId === operation.nodeId
            ? operation.index
            : childIndex >= 0
              ? childIndex
              : undefined

        createOps.push({
          type: 'mindmap.node.create',
          id: operation.id,
          node: cloneValue(node),
          parentId,
          index
        })

        const children = operation.subtree.children[nodeId] ?? []
        queue.push(...children)
      }
      return createOps
    }
    case 'mindmap.node.move': {
      return [
        {
          type: 'mindmap.node.move',
          id: operation.id,
          nodeId: operation.nodeId,
          fromParentId: operation.toParentId,
          toParentId: operation.fromParentId,
          fromIndex: operation.toIndex,
          toIndex: operation.fromIndex,
          side: operation.fromSide
        }
      ]
    }
    case 'mindmap.node.reorder': {
      return [
        {
          type: 'mindmap.node.reorder',
          id: operation.id,
          parentId: operation.parentId,
          fromIndex: operation.toIndex,
          toIndex: operation.fromIndex
        }
      ]
    }
    case 'viewport.update': {
      if (!operation.before) return null
      return [
        {
          type: 'viewport.update',
          before: cloneValue(operation.after),
          after: cloneValue(operation.before)
        }
      ]
    }
    default:
      return null
  }
}

const buildInverseOperations = (operations: Operation[]): { ok: true; operations: Operation[] } | { ok: false } => {
  const inverse: Operation[] = []
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const op = operations[index]
    const result = invertOperation(op)
    if (!result) {
      return { ok: false }
    }
    inverse.push(...result)
  }
  return { ok: true, operations: inverse }
}

export const createCoreHistory = ({ changes, now, applyOperations }: CreateCoreHistoryDeps) => {
  const config: CoreHistoryConfig = { ...DEFAULT_HISTORY_CONFIG }
  const listeners = new Set<(snapshot: CoreHistoryState) => void>()

  const collector: HistoryCollectorState = {
    isApplying: false,
    undo: [],
    redo: [],
    txDepth: 0,
    txDiscard: false,
    txForward: [],
    txInverse: [],
    txOrigin: undefined,
    txTimestamp: undefined
  }

  const emit = () => {
    const snapshot = createStateSnapshot(collector, now)
    listeners.forEach((listener) => listener(snapshot))
  }

  const trimUndo = () => {
    const capacity = Math.max(0, config.capacity)
    if (capacity === 0) {
      collector.undo = []
      return
    }
    if (collector.undo.length > capacity) {
      collector.undo.splice(0, collector.undo.length - capacity)
    }
  }

  const resetTransaction = () => {
    collector.txDiscard = false
    collector.txForward = []
    collector.txInverse = []
    collector.txOrigin = undefined
    collector.txTimestamp = undefined
  }

  const shouldCaptureOrigin = (origin?: Origin): boolean => {
    if (origin === 'system' && !config.captureSystem) return false
    if (origin === 'remote' && !config.captureRemote) return false
    return true
  }

  const pushUndo = (entry: HistoryEntry) => {
    collector.undo.push(entry)
    collector.redo = []
    trimUndo()
    emit()
  }

  const applyEntry = (operations: Operation[]): boolean => {
    if (!operations.length) return false
    const result = applyOperations(operations, 'system')
    return result.ok
  }

  const undo = (): boolean => {
    if (!collector.undo.length) {
      emit()
      return false
    }
    const entry = collector.undo.pop()
    if (!entry) return false
    collector.isApplying = true
    emit()
    try {
      const ok = applyEntry(entry.inverse)
      if (!ok) {
        collector.undo.push(entry)
        return false
      }
      collector.redo.push(entry)
    } finally {
      collector.isApplying = false
      emit()
    }
    return true
  }

  const redo = (): boolean => {
    if (!collector.redo.length) {
      emit()
      return false
    }
    const entry = collector.redo.pop()
    if (!entry) return false
    collector.isApplying = true
    emit()
    try {
      const ok = applyEntry(entry.forward)
      if (!ok) {
        collector.redo.push(entry)
        return false
      }
      collector.undo.push(entry)
      trimUndo()
    } finally {
      collector.isApplying = false
      emit()
    }
    return true
  }

  const clear = () => {
    collector.isApplying = false
    collector.undo = []
    collector.redo = []
    collector.txDepth = 0
    resetTransaction()
    emit()
  }

  const configure = (nextConfig: Partial<CoreHistoryConfig>) => {
    const previousCapacity = config.capacity
    if (typeof nextConfig.enabled === 'boolean') config.enabled = nextConfig.enabled
    if (typeof nextConfig.capacity === 'number') config.capacity = Math.max(0, nextConfig.capacity)
    if (typeof nextConfig.captureSystem === 'boolean') config.captureSystem = nextConfig.captureSystem
    if (typeof nextConfig.captureRemote === 'boolean') config.captureRemote = nextConfig.captureRemote
    if (previousCapacity !== config.capacity) {
      trimUndo()
      emit()
    }
  }

  const getState = (): CoreHistoryState => createStateSnapshot(collector, now)

  const subscribe = (listener: (snapshot: CoreHistoryState) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const afterHandler: ChangeHandlers['after'][number] = ({ changes }) => {
    if (!config.enabled) return
    if (collector.isApplying) return
    if (!shouldCaptureOrigin(changes.origin)) return

    if (collector.txDepth > 0 && collector.txDiscard) {
      return
    }

    const inverseResult = buildInverseOperations(changes.operations)
    if (!inverseResult.ok) {
      if (collector.txDepth > 0) {
        collector.txDiscard = true
        collector.txForward = []
        collector.txInverse = []
      }
      return
    }

    const entry: HistoryEntry = {
      forward: cloneOperations(changes.operations),
      inverse: cloneOperations(inverseResult.operations),
      timestamp: changes.timestamp,
      origin: changes.origin,
      source: collector.txDepth > 0 ? 'transaction' : 'single'
    }

    if (collector.txDepth > 0) {
      collector.txForward.push(...entry.forward)
      collector.txInverse = [...entry.inverse, ...collector.txInverse]
      collector.txOrigin ??= entry.origin
      collector.txTimestamp ??= entry.timestamp
      return
    }

    pushUndo(entry)
  }

  const transactionStartHandler: ChangeHandlers['transactionStart'][number] = () => {
    collector.txDepth += 1
    if (collector.txDepth === 1) {
      resetTransaction()
    }
  }

  const transactionEndHandler: ChangeHandlers['transactionEnd'][number] = () => {
    if (collector.txDepth <= 0) return
    collector.txDepth -= 1
    if (collector.txDepth > 0) return

    if (collector.txDiscard || collector.txForward.length === 0 || collector.txInverse.length === 0) {
      resetTransaction()
      return
    }

    pushUndo({
      forward: cloneOperations(collector.txForward),
      inverse: cloneOperations(collector.txInverse),
      timestamp: collector.txTimestamp ?? now(),
      origin: collector.txOrigin,
      source: 'transaction'
    })
    resetTransaction()
  }

  changes.after.push(afterHandler)
  changes.transactionStart.push(transactionStartHandler)
  changes.transactionEnd.push(transactionEndHandler)

  return {
    api: {
      undo,
      redo,
      clear,
      configure,
      getState,
      subscribe
    }
  }
}
