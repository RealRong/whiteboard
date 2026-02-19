import type { Node, Operation } from '@whiteboard/core'
import { HintPipeline } from './HintPipeline'

export type { Hint } from './types'
export type { HintTraceEntry, HintTraceEffect } from './trace'
export { HintContext } from './HintContext'
export { HintPipeline } from './HintPipeline'

const defaultHintPipeline = new HintPipeline()

export const hasNodeOperation = (operations: Operation[]) =>
  operations.some((operation) => operation.type.startsWith('node.'))

export const buildHint = (
  operations: Operation[],
  getNodes: () => Node[]
) => defaultHintPipeline.run(operations, getNodes)
