type WindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type WindowBindingsOrchestratorOptions = {
  bindings: WindowBinding[]
}

export class WindowBindingsOrchestrator {
  private bindings: WindowBinding[]

  constructor(options: WindowBindingsOrchestratorOptions) {
    this.bindings = options.bindings
  }

  start = () => {
    this.bindings.forEach((binding) => binding.start())
  }

  sync = () => {
    this.bindings.forEach((binding) => binding.sync())
  }

  stop = () => {
    this.bindings.forEach((binding) => binding.stop())
  }
}
