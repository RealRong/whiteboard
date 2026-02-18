import type { InternalInstance } from '@engine-types/instance/instance'

export class Cleanup {
  private instance: InternalInstance

  constructor(instance: InternalInstance) {
    this.instance = instance
  }

  stop = () => {
    this.instance.commands.transient.reset()
    this.instance.runtime.shortcuts.dispose()
    this.instance.runtime.services.nodeSizeObserver.dispose()
    this.instance.runtime.services.containerSizeObserver.dispose()
    this.instance.runtime.services.viewportNavigation.dispose()
    this.instance.runtime.services.edgeHover.dispose()
    this.instance.runtime.services.nodeDrag.dispose()
    this.instance.runtime.services.nodeTransform.dispose()
    this.instance.runtime.services.mindmapDrag.dispose()
  }
}
