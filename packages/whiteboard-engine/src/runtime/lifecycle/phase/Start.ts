import type { StartContext } from './types'

type StartOptions = {
  context: StartContext
}

export class Start {
  private context: StartContext

  constructor(options: StartOptions) {
    this.context = options.context
  }

  start = () => {
    this.context.shared.history.start()
    this.context.shared.autoFit.start()
    this.context.shared.windowKey.start()
    this.context.bindings.selectionCallbacks.start()
    this.context.bindings.window.start()
    this.context.shared.container.sync()
  }
}
