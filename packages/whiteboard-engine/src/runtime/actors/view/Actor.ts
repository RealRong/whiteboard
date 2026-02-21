import type { GraphChange } from '@engine-types/graph'

type ActorOptions = {
  syncGraph: (change: GraphChange) => void
}

export class Actor {
  readonly name = 'View'

  private readonly syncGraphRuntime: (change: GraphChange) => void

  constructor({ syncGraph }: ActorOptions) {
    this.syncGraphRuntime = syncGraph
  }

  sync = (change: GraphChange | undefined) => {
    if (!change) return
    this.syncGraphRuntime(change)
  }
}
