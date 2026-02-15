type Binding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type Options = {
  bindings: Binding[]
}

export class Bindings {
  private bindings: Binding[]

  constructor(options: Options) {
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
