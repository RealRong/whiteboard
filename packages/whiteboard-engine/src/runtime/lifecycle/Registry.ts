type LifecycleTask = () => void

type LifecycleEntry = {
  start?: LifecycleTask
  stop?: LifecycleTask
}

export class Registry {
  private readonly entries: LifecycleEntry[] = []

  register = (entry: LifecycleEntry) => {
    this.entries.push(entry)
  }

  startAll = () => {
    this.entries.forEach((entry) => {
      entry.start?.()
    })
  }

  stopAll = () => {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      this.entries[index].stop?.()
    }
  }
}
