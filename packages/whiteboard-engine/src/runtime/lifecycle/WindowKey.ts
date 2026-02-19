import type { LifecycleContext } from '../../context'
import type { DomBindings } from '../../host/dom'
import { bindSpaceKey } from './dom/spaceKey'

type WindowKeyContext = Pick<LifecycleContext, 'commands'>

export class WindowKey {
  private context: WindowKeyContext
  private dom: DomBindings
  private offSpaceKey: (() => void) | null = null

  constructor(context: WindowKeyContext, dom: DomBindings) {
    this.context = context
    this.dom = dom
  }

  start = () => {
    if (this.offSpaceKey) return
    this.offSpaceKey = bindSpaceKey({
      dom: this.dom,
      setSpacePressed: this.context.commands.keyboard.setSpacePressed
    })
  }

  stop = () => {
    this.offSpaceKey?.()
    this.offSpaceKey = null
    this.context.commands.keyboard.setSpacePressed(false)
  }
}
