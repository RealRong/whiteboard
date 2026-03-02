const DEFAULT_MAX_ATTEMPTS = 1024

const createSeed = () => Date.now().toString(36)

const createRandomSuffix = (length = 8) =>
  Math.random().toString(36).slice(2, 2 + length)

export const createScopedId = ({
  prefix,
  exists,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
}: {
  prefix: string
  exists: (id: string) => boolean
  maxAttempts?: number
}): string => {
  const seed = createSeed()
  for (let index = 0; index < maxAttempts; index += 1) {
    const id = `${prefix}_${seed}_${index.toString(36)}`
    if (!exists(id)) return id
  }
  return `${prefix}_${seed}_${createRandomSuffix(6)}`
}

export const createBatchId = (prefix: string): string =>
  `${prefix}_${createSeed()}_${createRandomSuffix()}`
