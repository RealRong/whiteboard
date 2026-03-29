import type { RuntimeRead } from '../read'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

const mergeReadAugment = (
  read: RuntimeRead,
  augment: Partial<RuntimeRead>
) => {
  const {
    context,
    draw,
    ...rest
  } = augment

  Object.assign(read, rest)

  if (context) {
    read.context = {
      ...read.context,
      ...context
    }
  }

  if (draw) {
    read.draw = {
      ...read.draw,
      ...draw
    }
  }
}

export const composeRead = ({
  base,
  capsules
}: {
  base: RuntimeRead
  capsules: readonly EditorFeatureCapsule[]
}): RuntimeRead => {
  capsules.forEach((capsule) => {
    if (!capsule.read) {
      return
    }

    mergeReadAugment(base, capsule.read)
  })

  return base
}
