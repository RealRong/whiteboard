export type Listener = () => void

export type IndexedState<TId extends string, TItem> = {
  list: TItem[]
  ids: TId[]
  byId: Map<TId, TItem>
}

export const isSameIdOrder = <TId extends string>(
  left: readonly TId[],
  right: readonly TId[]
) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const notifyListeners = (listeners?: Set<Listener>) => {
  if (!listeners?.size) return
  listeners.forEach((listener) => listener())
}

export const watchSet = (listeners: Set<Listener>, listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const createIndexedState = <TId extends string, TItem>(
  list: TItem[],
  pickId: (item: TItem) => TId
): IndexedState<TId, TItem> => {
  const ids: TId[] = []
  const byId = new Map<TId, TItem>()
  list.forEach((item) => {
    const id = pickId(item)
    ids.push(id)
    byId.set(id, item)
  })
  return { list, ids, byId }
}

export const updateIndexedState = <TId extends string, TItem>(
  current: IndexedState<TId, TItem>,
  nextList: TItem[],
  pickId: (item: TItem) => TId
): { state: IndexedState<TId, TItem>; changed: boolean } => {
  if (Object.is(current.list, nextList)) {
    return { state: current, changed: false }
  }
  return {
    state: createIndexedState(nextList, pickId),
    changed: true
  }
}
