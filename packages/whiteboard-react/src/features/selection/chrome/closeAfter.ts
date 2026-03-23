export const closeAfter = (
  result: unknown,
  close: () => void
) => {
  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    return Promise.resolve(result).finally(close)
  }

  close()
  return result
}
