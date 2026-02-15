import type { StopContext } from './types'

type StopOptions = {
  context: StopContext
}

export class Stop {
  private context: StopContext

  constructor(options: StopOptions) {
    this.context = options.context
  }

  stop = () => {
    this.context.shared.history.stop()
    this.context.cancelInput()
    this.context.bindings.window.stop()
    this.context.bindings.selectionCallbacks.stop()
    this.context.shared.container.stop()
    this.context.shared.windowKey.stop()
    this.context.shared.autoFit.stop()
    this.context.cleanup.stop()
  }
}
