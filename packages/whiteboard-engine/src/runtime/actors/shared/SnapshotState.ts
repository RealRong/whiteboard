type Equals<T> = (left: T, right: T) => boolean
type Clone<T> = (value: T) => T

const identity = <T,>(value: T): T => value

export class SnapshotState<T> {
  private snapshot?: T
  private hasSnapshot = false
  private readonly equals: Equals<T>
  private readonly clone: Clone<T>

  constructor(
    equals: Equals<T>,
    clone: Clone<T> = identity
  ) {
    this.equals = equals
    this.clone = clone
  }

  update = (next: T): boolean => {
    const changed =
      !this.hasSnapshot
      || !this.equals(this.snapshot as T, next)

    if (!changed) return false
    this.snapshot = this.clone(next)
    this.hasSnapshot = true
    return true
  }

  reset = () => {
    this.snapshot = undefined
    this.hasSnapshot = false
  }
}
