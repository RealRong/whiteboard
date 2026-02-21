import type { LifecycleRuntimeContext } from '../common/contracts'

type CleanupContext = Pick<LifecycleRuntimeContext, 'runtime' | 'commands'>

export type CleanupActors = {
  edge: {
    cancelInteractions: () => void
    hoverCancel: () => void
  }
  node: {
    cancelInteractions: () => void
  }
  mindmap: {
    cancelDrag: () => boolean
  }
}

export class Cleanup {
  private context: CleanupContext
  private actors: CleanupActors

  constructor(context: CleanupContext, actors: CleanupActors) {
    this.context = context
    this.actors = actors
  }

  stop = () => {
    this.actors.edge.cancelInteractions()
    this.actors.node.cancelInteractions()
    this.actors.mindmap.cancelDrag()
    this.context.commands.transient.reset()
    this.context.runtime.shortcuts.dispose()
    this.context.runtime.services.nodeSizeObserver.dispose()
    this.context.runtime.services.containerSizeObserver.dispose()
    this.context.runtime.services.viewportNavigation.dispose()
  }
}
