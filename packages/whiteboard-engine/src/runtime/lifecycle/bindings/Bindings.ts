type WindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type WindowBindingsOptions = {
  bindings: WindowBinding[]
}

export class Bindings {
  private bindings: WindowBinding[]

  constructor(options: WindowBindingsOptions) {
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
