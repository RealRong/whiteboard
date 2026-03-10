import type { Size } from '@engine-types/common'
import type { KernelReduceResult } from '@whiteboard/core/kernel'
import type { Document, Operation, Origin } from '@whiteboard/core/types'
import {
  createGroupNormalizer
} from './normalize/group'

type Reduce = (
  document: Document,
  operations: readonly Operation[],
  origin: Origin
) => KernelReduceResult

export type WriteNormalize = {
  reduce: (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ) => KernelReduceResult
}

export const createWriteNormalize = ({
  reduce,
  nodeSize,
  groupPadding
}: {
  reduce: Reduce
  nodeSize: Size
  groupPadding: number
}): WriteNormalize => {
  const normalizer = createGroupNormalizer({ nodeSize, groupPadding })

  const reduceWithNormalize = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => {
    const planned = reduce(document, operations, origin)
    if (!planned.ok) return planned

    if (!normalizer.shouldNormalize(planned.changes.operations)) {
      return planned
    }

    normalizer.ensure(document)
    const dirtyGroupIds = normalizer.analyze(
      planned.doc,
      planned.changes.operations
    )
    const normalizeOperations = normalizer.build(planned.doc, dirtyGroupIds)
    if (!normalizeOperations.length) {
      return planned
    }

    const reduced = reduce(
      document,
      [...planned.changes.operations, ...normalizeOperations],
      origin
    )
    if (!reduced.ok) {
      normalizer.reset(document)
      return reduced
    }

    normalizer.sync(reduced.doc, normalizeOperations)
    return reduced
  }

  return {
    reduce: reduceWithNormalize
  }
}
