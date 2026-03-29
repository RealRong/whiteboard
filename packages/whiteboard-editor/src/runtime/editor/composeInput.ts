import type { ValueStore } from '@whiteboard/engine'
import type {
  EditorInputInternals,
  EditorInputPolicy,
  EditorRuntime
} from '../../types/internal/editor'
import type { Editor } from '../../types/public/editor'
import {
  createInteractionRegistry,
  type InteractionCoordinator
} from '../interaction'
import { createPassiveInputRuntime } from '../input/passive'
import {
  createInputRuntime
} from '../input/runtime'
import type { PointerSnapshotStore } from '../input/pointerSnapshot'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

export const composeInput = ({
  commands,
  read,
  state,
  viewport,
  interaction,
  policy,
  pointer,
  capsules
}: {
  commands: Editor['commands']
  read: Editor['read']
  state: Editor['state']
  viewport: EditorRuntime['viewport']
  interaction: InteractionCoordinator
  policy: ValueStore<EditorInputPolicy>
  pointer: PointerSnapshotStore
  capsules: readonly EditorFeatureCapsule[]
}): {
  input: Editor['input']
  internals: EditorInputInternals
} => {
  const interactions = createInteractionRegistry(
    capsules.flatMap((capsule) => capsule.drivers ?? [])
  )
  const passive = createPassiveInputRuntime(
    capsules.flatMap((capsule) => capsule.passive ?? [])
  )

  const internals: EditorInputInternals = {
    interactions,
    passive,
    policy
  }

  const input = createInputRuntime({
    editor: {
      commands,
      read,
      state,
      viewport,
      interaction,
      internals: {
        input: internals
      }
    },
    pointer
  })

  return {
    input,
    internals
  }
}
