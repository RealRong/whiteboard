import type {
  DocumentCommitInput,
  DocumentCommitResult,
  OperationsCommitInput,
  OperationsCommitResult,
  Options as WriterOptions
} from '@engine-types/write/writer'
import { reduceOperations } from '@whiteboard/core/kernel'
import { createId } from '@whiteboard/core/utils'

export class Writer {
  private readonly document: WriterOptions['document']
  private readonly now: () => number

  constructor({
    document,
    now
  }: WriterOptions) {
    this.document = document
    this.now = now ?? (() => {
      const runtime = globalThis as { performance?: { now?: () => number } }
      if (typeof runtime.performance?.now === 'function') {
        return runtime.performance.now()
      }
      return Date.now()
    })
  }

  commitOperations({
    operations,
    origin
  }: OperationsCommitInput): OperationsCommitResult {
    const reduced = reduceOperations(this.document.get(), operations, {
      now: this.now,
      origin
    })
    if (!reduced.ok) {
      return reduced
    }

    this.document.commit(reduced.doc)

    return {
      ok: true,
      doc: reduced.doc,
      changes: reduced.changes,
      inverse: reduced.inverse
    }
  }

  commitDocument({
    doc,
    origin,
    timestamp
  }: DocumentCommitInput): DocumentCommitResult {
    this.document.commit(doc)

    return {
      ok: true,
      doc,
      changes: {
        id: createId('ms'),
        timestamp: timestamp ?? this.now(),
        operations: [],
        origin
      }
    }
  }
}
