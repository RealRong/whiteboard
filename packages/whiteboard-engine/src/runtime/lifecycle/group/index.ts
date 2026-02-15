import type { Instance } from '@engine-types/instance'

export class AutoFit {
  private instance: Instance

  constructor(instance: Instance) {
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
