import type { DocumentId, Operation } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import { buildCanvasNodeDirtyHint, hasNodeOperation } from './nodeHint'

type Options = {
  core: Instance['runtime']['core']
  state: Instance['state']
  getDocId: () => DocumentId | undefined
  emit: InstanceEventEmitter['emit']
}

export type DocEventsWatcher = {
  start: () => void
  stop: () => void
}

const toOperationTypes = (operations: Array<{ type: string }>): string[] => {
  const types = new Set<string>()
  operations.forEach((operation) => {
    types.add(operation.type)
  })
  return Array.from(types)
}

export const createDocEvents = ({
  core,
  state,
  getDocId,
  emit
}: Options): DocEventsWatcher => {
  let offAfter: (() => void) | null = null

  const start = () => {
    if (offAfter) return
    offAfter = core.changes.onAfter(({ changes }) => {
      if (hasNodeOperation(changes.operations)) {
        const hint = buildCanvasNodeDirtyHint(changes.operations, () =>
          core.query.node.list()
        )
        if (hint.forceFull) {
          state.requestCanvasNodeFullSync()
        } else {
          if (hint.dirtyNodeIds?.length) {
            state.reportCanvasNodeDirty(hint.dirtyNodeIds, 'doc')
          }
          if (hint.orderChanged) {
            state.reportCanvasNodeOrderChanged('doc')
          }
        }
      }
      emit('doc.changed', {
        docId: getDocId(),
        operationTypes: toOperationTypes(changes.operations),
        origin: changes.origin
      })
    })
  }

  const stop = () => {
    offAfter?.()
    offAfter = null
  }

  return {
    start,
    stop
  }
}
