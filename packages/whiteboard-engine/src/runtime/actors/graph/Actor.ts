import type {
  ApplyDispatchResult,
  ApplyResult
} from '@engine-types/command'
import type {
  GraphProjector
} from '@engine-types/graph'
import type { Node, Operation } from '@whiteboard/core'
import { GraphSync } from './sync/GraphSync'

type ActorOptions = {
  graph: GraphProjector
  readNodes: () => Node[]
}

const collectOperations = (
  dispatchResults: ApplyDispatchResult[]
): Operation[] => {
  const operations: Operation[] = []
  dispatchResults.forEach(({ result }) => {
    if (!result.ok) return
    operations.push(...result.changes.operations)
  })
  return operations
}

export class Actor {
  readonly name = 'Graph'

  private readonly graph: GraphProjector
  private readonly graphSync: GraphSync

  constructor({
    graph,
    readNodes
  }: ActorOptions) {
    this.graph = graph
    this.graphSync = GraphSync.fromOptions({
      graph,
      getNodes: readNodes
    })
  }

  syncAfterMutations = (operations: Operation[]) => {
    this.graphSync.syncByOperations(operations)
    return this.graph.flush('doc')
  }

  syncAfterApply = (applied: ApplyResult) =>
    this.syncAfterMutations(collectOperations(applied.dispatchResults))
}
