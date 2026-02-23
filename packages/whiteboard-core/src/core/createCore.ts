import type { Core, DispatchFailure, Document, Origin } from '../types/core'
import { createApplyOperations } from './apply'
import { createChangeHandlers, createChangeSetFactory, createTransaction, runAfterHandlers, runBeforeHandlers, TransactionContext } from './changes'
import { createCoreHistory } from './history'
import { createEventBus } from './events'
import { createModel } from './model'
import { createPluginHost, createCommandRegistry } from './plugins'
import { createCoreRegistries } from './registry'
import { createQuery } from './query'
import { createCoreState, type CreateCoreOptions } from './state'

export type { CreateCoreOptions }

export const createCore = (options: CreateCoreOptions = {}): Core => {
  const state = createCoreState(options)
  const eventBus = createEventBus()
  const changeHandlers = createChangeHandlers()
  const transactionStack: TransactionContext[] = []
  const createFailure = (reason: DispatchFailure['reason'], message?: string): DispatchFailure => ({
    ok: false,
    reason,
    message
  })

  const createChangeSet = createChangeSetFactory(state.createChangeSetId, state.now)
  const { applyOperations, applyChangeSet } = createApplyOperations({
    state,
    changeHandlers,
    eventBus,
    transactionStack,
    createChangeSet,
    runBeforeHandlers,
    runAfterHandlers,
    createFailure
  })

  const { registry: commandRegistry } = createCommandRegistry()
  const registries = createCoreRegistries(commandRegistry)

  const resolveOrigin = (origin?: Origin, fallback: Origin = 'user'): Origin =>
    origin ?? transactionStack[transactionStack.length - 1]?.options?.origin ?? fallback

  const transaction = createTransaction(transactionStack, changeHandlers)
  const query = createQuery(state)
  const model = createModel({
    state,
    registries,
    applyOperations,
    getOrigin: () => transactionStack[transactionStack.length - 1]?.options?.origin ?? 'system'
  })

  const applyDocumentSnapshot = (document: Document) => {
    state.applyDocument((draft) => {
      draft.id = document.id
      draft.name = document.name
      draft.nodes = document.nodes ?? []
      draft.edges = document.edges ?? []
      draft.mindmaps = document.mindmaps ?? []
      draft.order =
        document.order ??
        ({
          nodes: (document.nodes ?? []).map((node) => node.id),
          edges: (document.edges ?? []).map((edge) => edge.id)
        } as Document['order'])
      draft.background = document.background
      draft.viewport = document.viewport
      draft.meta = document.meta
    })
    state.rebuildMaps()
  }

  const history = createCoreHistory({
    changes: changeHandlers,
    now: state.now,
    applyOperations
  })

  const core: Core = {
    query,
    apply: {
      operations: (operations, options) => applyOperations(operations, resolveOrigin(options?.origin, 'user')),
      changeSet: (changes) => applyChangeSet(changes)
    },
    model,
    history: history.api,
    tx: transaction,
    events: {
      on: (type, handler) => {
        const set = eventBus.eventHandlers.get(type) ?? new Set()
        set.add(handler as (e: any) => void)
        eventBus.eventHandlers.set(type, set)
      },
      off: (type, handler) => {
        const set = eventBus.eventHandlers.get(type)
        if (!set) return
        set.delete(handler as (e: any) => void)
      }
    },
    changes: {
      onBefore: (handler) => {
        changeHandlers.before.push(handler)
        return () => {
          const index = changeHandlers.before.indexOf(handler)
          if (index >= 0) {
            changeHandlers.before.splice(index, 1)
          }
        }
      },
      onAfter: (handler) => {
        changeHandlers.after.push(handler)
        return () => {
          const index = changeHandlers.after.indexOf(handler)
          if (index >= 0) {
            changeHandlers.after.splice(index, 1)
          }
        }
      },
      transactionStart: (handler) => {
        changeHandlers.transactionStart.push(handler)
        return () => {
          const index = changeHandlers.transactionStart.indexOf(handler)
          if (index >= 0) {
            changeHandlers.transactionStart.splice(index, 1)
          }
        }
      },
      transactionEnd: (handler) => {
        changeHandlers.transactionEnd.push(handler)
        return () => {
          const index = changeHandlers.transactionEnd.indexOf(handler)
          if (index >= 0) {
            changeHandlers.transactionEnd.splice(index, 1)
          }
        }
      }
    },
    serialize: () => ({
      schemaVersion: state.schemaVersion,
      document: query.document()
    }),
    load: (snapshot) => {
      applyDocumentSnapshot(snapshot.document)
      history.api.clear()
    },
    registries,
    plugins: undefined as unknown as Core['plugins']
  }

  core.plugins = createPluginHost(core, registries)

  return core
}
