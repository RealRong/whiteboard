import type { ValueStore } from '@whiteboard/engine'
import type { Editor } from '../../types/editor'
import type { NodeRegistry } from '../../types/node'
import type { EditorInputPolicy, EditorViewportRuntime } from './types'
import type { InteractionCoordinator } from '../interaction'
import type { EdgeGuideRuntime } from '../feedback/edgeGuide'
import type { MarqueeFeedbackRuntime } from '../feedback/marquee'
import type { MindmapDragFeedbackRuntime } from '../feedback/mindmapDrag'
import type { SnapRuntime } from '../interaction/snap'
import type { EdgeTransientRuntime } from '../transient/edge'
import type { NodeTransientRuntime } from '../transient/node'

export type FeatureQuery = {
  read: Editor['read']
  config: Editor['config']
  registry: NodeRegistry
  interaction: Pick<InteractionCoordinator, 'mode' | 'state'>
  inputPolicy: ValueStore<EditorInputPolicy>
}

export type FeatureOutput = {
  edge: EdgeTransientRuntime
  node: NodeTransientRuntime
  edgeGuide: EdgeGuideRuntime
  marquee: MarqueeFeedbackRuntime
  mindmapDrag: MindmapDragFeedbackRuntime
  snap: SnapRuntime
}

export type FeatureRuntime = {
  query: FeatureQuery
  command: Editor['commands']
  viewport: EditorViewportRuntime
  output: FeatureOutput
}

export const createFeatureRuntime = ({
  command,
  read,
  config,
  viewport,
  interaction,
  registry,
  inputPolicy,
  output
}: {
  command: Editor['commands']
  read: Editor['read']
  config: Editor['config']
  viewport: EditorViewportRuntime
  interaction: InteractionCoordinator
  registry: NodeRegistry
  inputPolicy: ValueStore<EditorInputPolicy>
  output: FeatureOutput
}): FeatureRuntime => ({
  query: {
    read,
    config,
    registry,
    interaction: {
      mode: interaction.mode,
      state: interaction.state
    },
    inputPolicy
  },
  command,
  viewport,
  output
})
