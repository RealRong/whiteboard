import type { ValueStore } from '@whiteboard/engine'
import type {
  EditorInputInternals,
  EditorInputPolicy,
  EditorViewportRuntime
} from '../../types/internal/editor'
import type { Editor } from '../../types/editor'
import {
  createInteractionRegistry,
  type InteractionCoordinator,
  type InteractionRegistration
} from '../interaction'
import { createPassiveInputRuntime } from '../input/passive'
import {
  createInputRouter
} from '../input/router'
import type { PassiveInputProcessor } from '../input/passive'
import type { PointerSnapshotStore } from '../input/pointer/snapshot'

export const composeInput = ({
  commands,
  read,
  state,
  viewport,
  interaction,
  policy,
  pointer,
  interactions,
  passive
}: {
  commands: Editor['commands']
  read: Editor['read']
  state: Editor['state']
  viewport: EditorViewportRuntime
  interaction: InteractionCoordinator
  policy: ValueStore<EditorInputPolicy>
  pointer: PointerSnapshotStore
  interactions: readonly InteractionRegistration[]
  passive: readonly PassiveInputProcessor[]
}): Editor['input'] => {
  const runtime: EditorInputInternals = {
    interactions: createInteractionRegistry(
      interactions,
      interaction
    ),
    passive: createPassiveInputRuntime(passive),
    policy
  }

  const input = createInputRouter({
    editor: {
      commands,
      read,
      state,
      viewport,
      interaction
    },
    runtime,
    pointer
  })

  return input
}
