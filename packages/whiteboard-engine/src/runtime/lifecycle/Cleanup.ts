import type { LifecycleRuntimeContext } from '../common/contracts'

type CleanupContext = Pick<LifecycleRuntimeContext, 'runtime'>

export type CleanupActors = {
  edge: {
    cancelInteractions: () => void
    hoverCancel: () => void
    resetTransientState: () => void
  }
  node: {
    cancelInteractions: () => void
    resetTransientState: () => void
  }
  mindmap: {
    cancelDrag: () => boolean
    resetTransientState: () => void
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
    this.actors.edge.resetTransientState()
    this.actors.node.resetTransientState()
    this.actors.mindmap.resetTransientState()
    this.context.runtime.shortcuts.dispose()
    this.context.runtime.services.nodeSizeObserver.dispose()
    this.context.runtime.services.containerSizeObserver.dispose()
    this.context.runtime.services.viewportNavigation.dispose()
  }
}
