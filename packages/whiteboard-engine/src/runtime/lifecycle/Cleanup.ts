import type { LifecycleContext } from '../../context'

type CleanupContext = Pick<LifecycleContext, 'runtime' | 'commands'>

export class Cleanup {
  private context: CleanupContext

  constructor(context: CleanupContext) {
    this.context = context
  }

  stop = () => {
    this.context.runtime.interaction.edgeConnect.cancel()
    this.context.runtime.interaction.edgeConnect.hoverCancel()
    this.context.runtime.interaction.routingDrag.cancel()
    this.context.runtime.interaction.nodeDrag.cancel()
    this.context.runtime.interaction.nodeTransform.cancel()
    this.context.runtime.interaction.mindmapDrag.cancel()
    this.context.commands.transient.reset()
    this.context.runtime.shortcuts.dispose()
    this.context.runtime.services.nodeSizeObserver.dispose()
    this.context.runtime.services.containerSizeObserver.dispose()
    this.context.runtime.services.viewportNavigation.dispose()
  }
}
