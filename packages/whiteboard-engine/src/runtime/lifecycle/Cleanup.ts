import type { InternalInstance } from '@engine-types/instance/instance'

export class Cleanup {
  private instance: InternalInstance

  constructor(instance: InternalInstance) {
    this.instance = instance
  }

  stop = () => {
    this.instance.runtime.interaction.edgeConnect.cancel()
    this.instance.runtime.interaction.edgeConnect.hoverCancel()
    this.instance.runtime.interaction.routingDrag.cancel()
    this.instance.runtime.interaction.nodeDrag.cancel()
    this.instance.runtime.interaction.nodeTransform.cancel()
    this.instance.runtime.interaction.mindmapDrag.cancel()
    this.instance.commands.transient.reset()
    this.instance.runtime.shortcuts.dispose()
    this.instance.runtime.services.nodeSizeObserver.dispose()
    this.instance.runtime.services.containerSizeObserver.dispose()
    this.instance.runtime.services.viewportNavigation.dispose()
  }
}
