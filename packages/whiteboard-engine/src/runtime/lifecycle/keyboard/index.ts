import type { Instance } from '@engine-types/instance'
import { bindWindowSpaceKey } from '../bindings'

export class WindowKey {
  private instance: Instance
  private offWindowSpaceKey: (() => void) | null = null

  constructor(instance: Instance) {
    this.instance = instance
  }

  start = () => {
    if (this.offWindowSpaceKey) return
    this.offWindowSpaceKey = bindWindowSpaceKey({
      events: this.instance.runtime.events,
      setSpacePressed: this.instance.commands.keyboard.setSpacePressed
    })
  }

  stop = () => {
    this.offWindowSpaceKey?.()
    this.offWindowSpaceKey = null
    this.instance.commands.keyboard.setSpacePressed(false)
  }
}
