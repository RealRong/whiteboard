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
  createInputRouter
} from '../input/router'
import type { PointerSnapshotStore } from '../input/pointer/snapshot'
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
    capsules.flatMap((capsule) => capsule.interactions ?? []),
    interaction
  )
  const passive = createPassiveInputRuntime(
    capsules.flatMap((capsule) => capsule.passive ?? [])
  )

  const internals: EditorInputInternals = {
    interactions,
    passive,
    policy
  }

  const input = createInputRouter({
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
