import type { Instance } from '@engine-types/instance/instance'
import type { DomBindings } from '../../host/dom'
import { bindSpaceKey } from './bindings/spaceKey'

type Options = {
  instance: Instance
  dom: DomBindings
}

export class WindowKey {
  private instance: Instance
  private dom: DomBindings
  private offSpaceKey: (() => void) | null = null

  constructor({ instance, dom }: Options) {
    this.instance = instance
    this.dom = dom
  }

  start = () => {
    if (this.offSpaceKey) return
    this.offSpaceKey = bindSpaceKey({
      dom: this.dom,
      setSpacePressed: this.instance.commands.keyboard.setSpacePressed
    })
  }

  stop = () => {
    this.offSpaceKey?.()
    this.offSpaceKey = null
    this.instance.commands.keyboard.setSpacePressed(false)
  }
}
