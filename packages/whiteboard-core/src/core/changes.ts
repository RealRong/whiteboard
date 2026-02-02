import type { AfterChangeSet, BeforeChangeSet, ChangeSet, Origin, TransactionOptions, TransactionResult, TransactionSummary } from '../types/core'

export type ChangeHandlers = {
  before: Array<(e: BeforeChangeSet) => void | false>
  after: Array<(e: AfterChangeSet) => void>
  transactionStart: Array<() => void>
  transactionEnd: Array<(e: TransactionSummary) => void>
}

export type TransactionContext = {
  options?: TransactionOptions
  changes: ChangeSet[]
}

export const createChangeHandlers = (): ChangeHandlers => ({
  before: [],
  after: [],
  transactionStart: [],
  transactionEnd: []
})

export const runBeforeHandlers = (handlers: ChangeHandlers, changes: ChangeSet): boolean => {
  let cancelled = false
  const event: BeforeChangeSet = {
    changes,
    cancel: () => {
      cancelled = true
    }
  }
  for (const handler of handlers.before) {
    const result = handler(event)
    if (result === false) {
      cancelled = true
    }
    if (cancelled) break
  }
  return cancelled
}

export const runAfterHandlers = (handlers: ChangeHandlers, changes: ChangeSet) => {
  const event: AfterChangeSet = { changes }
  handlers.after.forEach((handler) => handler(event))
}

export const createChangeSetFactory = (createChangeSetId: () => string, now: () => number) => {
  return (operations: ChangeSet['operations'], origin?: Origin): ChangeSet => ({
    id: createChangeSetId(),
    timestamp: now(),
    operations,
    origin
  })
}

export const mergeChangeSets = (
  changes: ChangeSet[],
  createChangeSetId: () => string,
  now: () => number,
  origin?: Origin
): ChangeSet => ({
  id: createChangeSetId(),
  timestamp: now(),
  origin,
  operations: changes.flatMap((item) => item.operations)
})

export const createTransaction = (
  transactionStack: TransactionContext[],
  handlers: ChangeHandlers
) => async <T,>(fn: () => T | Promise<T>, options?: TransactionOptions): Promise<TransactionResult<T>> => {
  const isOuter = transactionStack.length === 0
  const context: TransactionContext = { options, changes: [] }
  transactionStack.push(context)
  if (isOuter) {
    handlers.transactionStart.forEach((handler) => handler())
  }
  let result: T
  try {
    result = await fn()
  } finally {
    transactionStack.pop()
    if (isOuter) {
      handlers.transactionEnd.forEach((handler) => handler({ changes: context.changes }))
    } else {
      const parent = transactionStack[transactionStack.length - 1]
      if (parent) {
        parent.changes.push(...context.changes)
      }
    }
  }
  return { result, changes: context.changes }
}
