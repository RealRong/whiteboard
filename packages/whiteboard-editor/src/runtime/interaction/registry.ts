import type { PointerDown } from '../input/pointer'
import type { InteractionDriver } from './types'

const byPriorityDesc = (
  left: InteractionDriver,
  right: InteractionDriver
) => (right.priority ?? 0) - (left.priority ?? 0)

export type InteractionRegistry = {
  start: (input: PointerDown) => boolean
  cancel: () => void
}

export const createInteractionRegistry = (
  drivers: readonly InteractionDriver[]
): InteractionRegistry => {
  const ordered = [...drivers].sort(byPriorityDesc)

  return {
    start: (input) => {
      for (let index = 0; index < ordered.length; index += 1) {
        const driver = ordered[index]!
        const resolved = driver.resolve(input)
        if (!resolved) {
          continue
        }

        if (driver.start(resolved)) {
          return true
        }
      }

      return false
    },
    cancel: () => {
      ordered.forEach((driver) => {
        driver.cancel?.()
      })
    }
  }
}
