import type { WhiteboardInstance } from '@engine-types/instance'

export class GroupAutoFitLifecycleController {
  private instance: WhiteboardInstance

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
  }

  start = () => {
    this.instance.runtime.services.groupAutoFit.start({
      getDocId: () => this.instance.runtime.docRef.current?.id,
      getNodes: () => this.instance.runtime.docRef.current?.nodes ?? [],
      getNodeSize: () => this.instance.runtime.config.nodeSize,
      getPadding: () => this.instance.runtime.config.node.groupPadding
    })
  }

  stop = () => {
    this.instance.runtime.services.groupAutoFit.stop()
  }
}
