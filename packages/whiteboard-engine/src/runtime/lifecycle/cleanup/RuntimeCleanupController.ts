import type { WhiteboardInstance } from '@engine-types/instance'

export class RuntimeCleanupController {
  private instance: WhiteboardInstance

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
  }

  stop = () => {
    this.instance.commands.transient.reset()
    this.instance.runtime.shortcuts.dispose()
    this.instance.runtime.services.nodeSizeObserver.dispose()
    this.instance.runtime.services.containerSizeObserver.dispose()
    this.instance.runtime.services.viewportNavigation.dispose()
    this.instance.runtime.services.edgeHover.dispose()
    this.instance.runtime.services.nodeTransform.dispose()
    this.instance.runtime.services.mindmapDrag.dispose()
  }
}
