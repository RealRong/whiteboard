import type { BoardConfig } from '@whiteboard/core/config'
import type { Editor } from '../../types/editor'
import type { EditorOverlay } from '../overlay'
import type { RuntimeStateController } from '../state'
import type { SnapRuntime } from './snap'

export type InteractionCtx = {
  read: Editor['read']
  state: RuntimeStateController['state']
  config: Readonly<BoardConfig>
  commands: Editor['commands']
  overlay: EditorOverlay
  snap: SnapRuntime
}
