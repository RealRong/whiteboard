import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { MutationAppliedChange } from './MutationExecutor'

const toOperationTypes = (operations: Array<{ type: string }>, reset = false) => {
  const types = new Set<string>()
  if (reset) {
    types.add('doc.reset')
  }
  operations.forEach((operation) => {
    types.add(operation.type)
  })
  return Array.from(types)
}

type DocChangePublisherOptions = {
  emit: InstanceEventEmitter['emit']
}

export class DocChangePublisher {
  private readonly emit: DocChangePublisherOptions['emit']

  constructor({ emit }: DocChangePublisherOptions) {
    this.emit = emit
  }

  publish = ({ docId, origin, operations, reset }: MutationAppliedChange) => {
    const operationTypes = toOperationTypes(operations, reset)
    if (!operationTypes.length) return
    this.emit('doc.changed', {
      docId,
      operationTypes,
      origin
    })
  }
}
