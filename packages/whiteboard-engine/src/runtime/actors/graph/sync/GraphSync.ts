import type { GraphProjector } from '@engine-types/graph'
import type { Node, Operation } from '@whiteboard/core'
import { buildHint, hasNodeOperation, type Hint } from './hint'

type Options = {
  graph: GraphProjector
  getNodes: () => Node[]
}

export class GraphSync {
  constructor(
    private readonly graph: GraphProjector,
    private readonly getNodes: () => Node[]
  ) {}

  static fromOptions = ({ graph, getNodes }: Options) =>
    new GraphSync(graph, getNodes)

  syncByOperations = (operations: Operation[]) => {
    if (!hasNodeOperation(operations)) return
    const hint = buildHint(operations, this.getNodes)
    this.applyHint(hint)
  }

  private applyHint = (hint: Hint) => {
    this.graph.applyHint(hint, 'doc')
  }
}
