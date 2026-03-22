import type { KernelReduceResult } from '@whiteboard/core/kernel'
import type {
  Document,
  Operation,
  Origin,
  Size
} from '@whiteboard/core/types'
import {
  collectGroupOps
} from '../document/normalize/group'
import {
  sanitizeOperations
} from '../document/normalize/sanitize'
import {
  collectChanges,
  collectDirtyNodeIds,
  collectFinalizeOps,
} from './normalize/finalize'

type Reduce = (
  document: Document,
  operations: readonly Operation[],
  origin: Origin
) => KernelReduceResult

type WritePipeline = {
  run: (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ) => KernelReduceResult
}

type Reduced = Extract<KernelReduceResult, { ok: true }>

export const createWritePipeline = ({
  reduce,
  nodeSize,
  groupPadding
}: {
  reduce: Reduce
  nodeSize: Size
  groupPadding: number
}): WritePipeline => {
  const append = (
    document: Document,
    reduced: Reduced,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => (
    operations.length > 0
      ? reduce(
          document,
          [...reduced.changes.operations, ...operations],
          origin
        )
      : reduced
  )

  const deriveChanges = (
    beforeDocument: Document,
    reduced: Reduced
  ) => collectChanges({
    beforeDocument,
    afterDocument: reduced.doc,
    operations: reduced.changes.operations
  })

  const runFinalizeStep = (
    beforeDocument: Document,
    reduced: Reduced,
    origin: Origin
  ): KernelReduceResult => {
    const changes = deriveChanges(beforeDocument, reduced)
    const operations = collectFinalizeOps({
      afterDocument: reduced.doc,
      changes,
      nodeSize
    })

    return append(
      beforeDocument,
      reduced,
      operations,
      origin
    )
  }

  const runGroupStep = (
    beforeDocument: Document,
    reduced: Reduced,
    origin: Origin
  ): KernelReduceResult => {
    const changes = deriveChanges(beforeDocument, reduced)
    const dirtyNodeIds = collectDirtyNodeIds(changes)
    if (!dirtyNodeIds.size) {
      return reduced
    }

    const operations = collectGroupOps({
      document: reduced.doc,
      nodeIds: dirtyNodeIds,
      nodeSize,
      groupPadding,
    })

    return append(
      beforeDocument,
      reduced,
      operations,
      origin
    )
  }

  const run = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => {
    const sanitizedOperations = sanitizeOperations({
      document,
      operations
    })
    const base = reduce(document, sanitizedOperations, origin)
    if (!base.ok) return base

    const finalized = runFinalizeStep(document, base, origin)
    if (!finalized.ok) {
      return finalized
    }

    return runGroupStep(document, finalized, origin)
  }

  return {
    run
  }
}
