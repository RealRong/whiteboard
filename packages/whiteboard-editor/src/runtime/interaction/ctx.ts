import type { Editor } from '../../types/editor'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../../types/runtime/interaction'
import type { EditorOverlay } from '../overlay'
import type { RuntimeStateController } from '../state'
import type { SnapRuntime } from './snap'

export type InteractionCtx = {
  read: Editor['read']
  state: RuntimeStateController['state']
  config: Editor['config']
  registry: NodeRegistry
  interaction: Pick<InteractionCoordinator, 'mode' | 'state'>
  commands: Editor['commands']
  overlay: EditorOverlay
  snap: SnapRuntime
}
