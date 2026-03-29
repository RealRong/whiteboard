import type { Editor } from './types'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

const mergeCommandAugment = (
  commands: Editor['commands'],
  augment: Partial<Editor['commands']>
) => {
  const {
    context,
    ...rest
  } = augment

  Object.assign(commands, rest)

  if (context) {
    commands.context = {
      ...commands.context,
      ...context
    }
  }
}

export const composeCommands = ({
  base,
  capsules
}: {
  base: Editor['commands']
  capsules: readonly EditorFeatureCapsule[]
}): Editor['commands'] => {
  capsules.forEach((capsule) => {
    if (!capsule.commands) {
      return
    }

    mergeCommandAugment(base, capsule.commands)
  })

  return base
}
