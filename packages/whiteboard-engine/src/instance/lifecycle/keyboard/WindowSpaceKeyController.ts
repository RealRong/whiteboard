import type { WhiteboardInstance } from '@engine-types/instance'
import { bindWindowSpaceKey } from '../bindings/bindWindowSpaceKey'

export class WindowSpaceKeyController {
  private instance: WhiteboardInstance
  private offWindowSpaceKey: (() => void) | null = null

  constructor(instance: WhiteboardInstance) {
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
