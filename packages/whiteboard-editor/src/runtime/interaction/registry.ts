import type { PointerDown } from '../input/pointer'
import type {
  InteractionCoordinator,
  InteractionRegistration,
  InteractionRegistry
} from '../../types/runtime/interaction'

const byPriorityDesc = (
  left: InteractionRegistration,
  right: InteractionRegistration
) => (right.priority ?? 0) - (left.priority ?? 0)

export const createInteractionRegistry = (
  registrations: readonly InteractionRegistration[],
  interaction: Pick<InteractionCoordinator, 'start'>
): InteractionRegistry => {
  const ordered = [...registrations].sort(byPriorityDesc)

  const start = (
    input: PointerDown
  ) => {
    for (let index = 0; index < ordered.length; index += 1) {
      const registration = ordered[index]
      const started = registration
        ? interaction.start(registration, input)
        : false
      if (started) {
        return true
      }
    }

    return false
  }

  return {
    start
  }
}
