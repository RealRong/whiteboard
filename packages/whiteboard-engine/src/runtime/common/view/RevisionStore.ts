export class RevisionStore<TKey extends string> {
  private revisions = new Map<TKey, number>()
  private globalRevision = 0

  get = (key: TKey): number => this.revisions.get(key) ?? 0

  getGlobal = (): number => this.globalRevision

  bump = (key: TKey): number => {
    const next = this.get(key) + 1
    this.revisions.set(key, next)
    this.globalRevision += 1
    return next
  }

  signature = (keys: readonly TKey[]): string =>
    keys.map((key) => `${key}:${this.get(key)}`).join('|')

  snapshot = (): Record<TKey, number> =>
    Object.fromEntries(this.revisions.entries()) as Record<TKey, number>
}
