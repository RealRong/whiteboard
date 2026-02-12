import type { Core, DispatchFailure, DispatchOptions, DispatchResult, Document, Intent, IntentHandler, Origin } from '../types/core'
import { createApplyOperations } from './apply'
import { createBuildOperations } from './build'
import { createChangeHandlers, createChangeSetFactory, createTransaction, runAfterHandlers, runBeforeHandlers, TransactionContext } from './changes'
import { createCommands } from './commands'
import { createEventBus } from './events'
import { createModel } from './model'
import { createPluginHost, createCommandRegistry } from './plugins'
import { createCoreRegistries } from './registry'
import { createQuery } from './query'
import { createCoreState, type CreateCoreOptions } from './state'
import { createValidateIntent } from './validate'

export type { CreateCoreOptions }

export const createCore = (options: CreateCoreOptions = {}): Core => {
  const state = createCoreState(options)
  const eventBus = createEventBus()
  const changeHandlers = createChangeHandlers()
  const intentHandlers: IntentHandler[] = []
  const transactionStack: TransactionContext[] = []
  const createFailure = (reason: DispatchFailure['reason'], message?: string): DispatchFailure => ({
    ok: false,
    reason,
    message
  })

  const createChangeSet = createChangeSetFactory(state.createChangeSetId, state.now)
  const { applyOperations } = createApplyOperations({
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

  const validateIntent = createValidateIntent(state, registries)
  const { buildOperations } = createBuildOperations({ state, registries, validateIntent, createFailure })

  const applyIntent = (intent: Intent, origin?: Origin): DispatchResult => {
    const buildResult = buildOperations(intent)
    if (!('operations' in buildResult)) {
      return buildResult
    }
    const result = applyOperations(buildResult.operations, origin)
    if (!result.ok) {
      return result
    }
    if (buildResult.value === undefined) {
      return result
    }
    return { ...result, value: buildResult.value }
  }

  const runIntentHandlers = (intent: Intent, options?: DispatchOptions): Promise<DispatchResult> => {
    const origin = options?.origin ?? transactionStack[transactionStack.length - 1]?.options?.origin ?? 'user'
    const run = (index: number, nextIntent: Intent): Promise<DispatchResult> => {
      const handler = intentHandlers[index]
      if (!handler) {
        return Promise.resolve(applyIntent(nextIntent, origin))
      }
      return handler(nextIntent, (innerIntent) => run(index + 1, innerIntent))
    }
    return run(0, intent)
  }

  const dispatch = (intent: Intent, options?: DispatchOptions) => runIntentHandlers(intent, options)

  const transaction = createTransaction(transactionStack, changeHandlers)
  const query = createQuery(state)
  const model = createModel({
    state,
    registries,
    applyOperations,
    getOrigin: () => transactionStack[transactionStack.length - 1]?.options?.origin ?? 'system'
  })

  const commands = createCommands({
    state,
    dispatch,
    transaction,
    createFailure,
    createChangeSetId: state.createChangeSetId,
    now: state.now
  })

  const core: Core = {
    query,
    dispatch,
    model,
    commands,
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
    intent: {
      use: (handler) => {
        intentHandlers.push(handler)
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
      state.applyDocument((draft) => {
        draft.id = snapshot.document.id
        draft.name = snapshot.document.name
        draft.nodes = snapshot.document.nodes ?? []
        draft.edges = snapshot.document.edges ?? []
        draft.mindmaps = snapshot.document.mindmaps ?? []
        draft.order =
          snapshot.document.order ??
          ({
            nodes: (snapshot.document.nodes ?? []).map((node) => node.id),
            edges: (snapshot.document.edges ?? []).map((edge) => edge.id)
          } as Document['order'])
        draft.background = snapshot.document.background
        draft.viewport = snapshot.document.viewport
        draft.meta = snapshot.document.meta
      })
      state.rebuildMaps()
    },
    registries,
    plugins: undefined as unknown as Core['plugins']
  }

  core.plugins = createPluginHost(core, registries)

  return core
}
