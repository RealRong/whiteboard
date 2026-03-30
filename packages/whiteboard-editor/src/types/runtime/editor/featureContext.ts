import type { ValueStore } from '@whiteboard/engine'
import type { Editor } from '../../editor'
import type { NodeRegistry } from '../../node'
import type {
  DrawFeatureState,
  EditorInputPolicy,
  EditorViewportRuntime,
} from '../../internal/editor'
import type { EdgeProjection } from '../../../features/edge/projection'
import type { MindmapDragProjectionStore } from '../../../features/mindmap/drag/projection'
import type { NodeProjectionRuntime } from '../../../features/node/projection/store'
import type { SnapRuntime } from '../../../runtime/interaction/snap'
import type { InteractionCoordinator } from '../../../runtime/interaction/types'
import type { PickRuntime } from '../../../runtime/pick'

export type EditorFeatureProjectionSet = {
  node: NodeProjectionRuntime
  edge: EdgeProjection
  mindmapDrag: MindmapDragProjectionStore
}

export type EditorFeatureSpatial = {
  pick: PickRuntime
  snap: SnapRuntime
}

export type EditorFeatureContext = {
  commands: Editor['commands']
  read: Editor['read']
  state: Editor['state']
  config: Editor['config']
  viewport: EditorViewportRuntime
  interaction: InteractionCoordinator
  registry: NodeRegistry
  inputPolicy: ValueStore<EditorInputPolicy>
  draw: DrawFeatureState
  projection: EditorFeatureProjectionSet
  spatial: EditorFeatureSpatial
}
