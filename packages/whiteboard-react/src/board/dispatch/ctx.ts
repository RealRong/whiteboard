import type { BoardConfig } from '@whiteboard/core/config'
import type {
  Editor as EditorRuntime,
  EditorTransient
} from '../../board/types'
import type { ValueStore } from '@whiteboard/engine'
import type { SnapRuntime } from './snap'

export type InteractionInputPolicy = {
  panEnabled: boolean
  wheelEnabled: boolean
  wheelSensitivity: number
}

export type InteractionLocalState = {
  viewport: {
    input: Pick<EditorRuntime['commands']['viewport'], 'panScreenBy'>
  }
  space: ValueStore<boolean>
  inputPolicy: ValueStore<InteractionInputPolicy>
}

export type InteractionCtx = {
  read: EditorRuntime['read']
  state: InteractionLocalState
  config: Readonly<BoardConfig>
  commands: EditorRuntime['commands']
  overlay: EditorTransient
  snap: SnapRuntime
}
