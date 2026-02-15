import type { Instance } from '@engine-types/instance'
import { bindSpaceKey } from '../bindings'

export class WindowKey {
  private instance: Instance
  private offSpaceKey: (() => void) | null = null

  constructor(instance: Instance) {
    this.instance = instance
  }

  start = () => {
    if (this.offSpaceKey) return
    this.offSpaceKey = bindSpaceKey({
      events: this.instance.runtime.events,
      setSpacePressed: this.instance.commands.keyboard.setSpacePressed
    })
  }

  stop = () => {
    this.offSpaceKey?.()
    this.offSpaceKey = null
    this.instance.commands.keyboard.setSpacePressed(false)
  }
}
