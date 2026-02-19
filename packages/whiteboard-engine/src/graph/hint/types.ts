import type { GraphHint } from '@engine-types/graph'
import type { Operation } from '@whiteboard/core'
import type { HintContext } from './HintContext'

export type Hint = GraphHint

export type HintRule = {
  canHandle: (operation: Operation) => boolean
  apply: (operation: Operation, context: HintContext) => void
}
