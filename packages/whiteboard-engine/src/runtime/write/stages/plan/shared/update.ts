type UpdateInput<
  TId extends string,
  TPatch extends Record<string, unknown>
> = {
  id: TId
  patch: TPatch
}

const hasPatch = <TPatch extends Record<string, unknown>>(patch: TPatch) =>
  Object.keys(patch).length > 0

const mergeUpdatesById = <
  TId extends string,
  TPatch extends Record<string, unknown>
>(
  updates: readonly UpdateInput<TId, TPatch>[]
) => {
  const patchById = new Map<TId, TPatch>()

  updates.forEach((item) => {
    if (!hasPatch(item.patch)) return
    const previous = patchById.get(item.id)
    patchById.set(
      item.id,
      previous
        ? { ...previous, ...item.patch }
        : item.patch
    )
  })

  return patchById
}

export const toUpdateOperations = <
  TType extends 'node.update' | 'edge.update',
  TId extends string,
  TPatch extends Record<string, unknown>
>(
  type: TType,
  updates: readonly UpdateInput<TId, TPatch>[]
) =>
  Array.from(mergeUpdatesById(updates).entries()).map(([id, patch]) => ({
    type,
    id,
    patch
  }))

