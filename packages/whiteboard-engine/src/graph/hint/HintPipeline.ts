import type { Node, Operation } from '@whiteboard/core'
import { HintContext } from './HintContext'
import { CreateRule } from './rules/CreateRule'
import { DeleteRule } from './rules/DeleteRule'
import { OrderRule } from './rules/OrderRule'
import { UpdateRule } from './rules/UpdateRule'
import type { Hint, HintRule } from './types'

const DEFAULT_RULES: HintRule[] = [
  new UpdateRule(),
  new OrderRule(),
  new CreateRule(),
  new DeleteRule()
]

export class HintPipeline {
  constructor(private readonly rules: HintRule[] = DEFAULT_RULES) {}

  run = (operations: Operation[], getNodes: () => Node[]): Hint => {
    const context = new HintContext(getNodes)

    operations.forEach((operation) => {
      if (context.isForceFull()) return
      const rule = this.rules.find((item) => item.canHandle(operation))
      if (!rule) return
      rule.apply(operation, context)
    })

    return context.buildHint()
  }
}
