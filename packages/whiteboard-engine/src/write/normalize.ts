import type { Size } from '@engine-types/common'
import type { KernelReduceResult } from '@whiteboard/core/kernel'
import { normalizeGroupBounds } from '@whiteboard/core/node'
import type { Document, Operation, Origin } from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../config'

type Reduce = (
  document: Document,
  operations: readonly Operation[],
  origin: Origin
) => KernelReduceResult

export type WriteNormalize = {
  document: (document: Document, origin: Origin) => Document
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
  const buildOperations = (document: Document): readonly Operation[] =>
    normalizeGroupBounds({
      document,
      nodeSize,
      groupPadding,
      rectEpsilon: DEFAULT_TUNING.group.rectEpsilon
    })

  const normalizeDocument = (document: Document, origin: Origin): Document => {
    const operations = buildOperations(document)
    if (!operations.length) return document

    const normalized = reduce(document, operations, origin)
    if (normalized.ok) {
      return normalized.doc
    }

    throw new Error(`Group normalize failed: ${normalized.message}`)
  }

  const reduceWithNormalize = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => {
    const planned = reduce(document, operations, origin)
    if (!planned.ok) return planned

    const normalizeOperations = buildOperations(planned.doc)
    if (!normalizeOperations.length) {
      return planned
    }

    return reduce(
      document,
      [...planned.changes.operations, ...normalizeOperations],
      origin
    )
  }

  return {
    document: normalizeDocument,
    reduce: reduceWithNormalize
  }
}
