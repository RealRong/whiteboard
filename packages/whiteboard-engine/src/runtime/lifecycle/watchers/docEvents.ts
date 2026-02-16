import type { DocumentId } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance'
import type { InstanceEventEmitter } from '@engine-types/instance/events'

type Options = {
  core: Instance['runtime']['core']
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
  getDocId,
  emit
}: Options): DocEventsWatcher => {
  let offAfter: (() => void) | null = null

  const start = () => {
    if (offAfter) return
    offAfter = core.changes.onAfter(({ changes }) => {
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
