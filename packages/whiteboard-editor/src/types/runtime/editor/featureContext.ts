import type { ValueStore } from '@whiteboard/engine'
import type { Editor } from '../../editor'
import type { NodeRegistry } from '../../node'
import type {
  DrawFeatureState,
  EditorInputPolicy,
  EditorViewportRuntime,
} from '../../internal/editor'
import type { EdgeProjectionRuntime } from '../../../runtime/projection/edge'
import type { MindmapDragProjectionStore } from '../../../runtime/projection/mindmapDrag'
import type { NodeProjectionRuntime } from '../../../runtime/projection/node'
import type { SnapRuntime } from '../../../runtime/interaction/snap'
import type { InteractionCoordinator } from '../interaction'

export type EditorFeatureProjectionSet = {
  node: NodeProjectionRuntime
  edge: EdgeProjectionRuntime
  mindmapDrag: MindmapDragProjectionStore
}

export type EditorFeatureSpatial = {
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
