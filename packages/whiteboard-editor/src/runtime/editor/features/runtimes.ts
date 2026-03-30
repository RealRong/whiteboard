import type { ValueStore } from '@whiteboard/engine'
import type { InteractionRegistration } from '../../interaction'
import type { PassiveInputProcessor } from '../../input/passive'
import { createDrawInteraction } from '../../../features/draw/interaction'
import { createEdgeHoverProcessor } from '../../../features/edge/hoverProcessor'
import { createEdgeEditInteraction } from '../../../features/edge/edit/interaction'
import type { EdgeProjection } from '../../../features/edge/projection'
import { createEdgeConnectInteraction } from '../../../features/edge/connect/interaction'
import { createMindmapDragInteraction } from '../../../features/mindmap/drag/interaction'
import type { MindmapDragProjectionStore } from '../../../features/mindmap/drag/projection'
import { createNodeTransformInteraction } from '../../../features/node/transform/interaction'
import type { NodeProjectionRuntime } from '../../../features/node/projection/store'
import { createSelectionPressInteraction } from '../../../features/selection/interaction'
import { createMarqueeInteraction } from '../../../features/selection/marquee'
import type { DrawInteraction } from '../../../features/draw/interaction'
import type { EdgeEditInteraction } from '../../../features/edge/edit/interaction'
import type { EdgeConnectInteraction } from '../../../features/edge/connect/interaction'
import type { MindmapDragInteraction } from '../../../features/mindmap/drag/interaction'
import type { NodeTransformInteraction } from '../../../features/node/transform/interaction'
import type { SelectionPressInteraction } from '../../../features/selection/interaction'
import type { MarqueeInteraction } from '../../../features/selection/marquee'
import type {
  DrawFeatureState,
  EditorKernel,
  EditorViewportRuntime
} from '../../../types/internal/editor'
import type { Editor } from '../../../types/public/editor'
import {
  createContextRuntime,
  type ContextMenuView
} from '../../context'
import type { ContextRuntime } from '../../../types/public/context'
import { createInsertPresetInteraction } from '../../../features/toolbox/insert'
import { createViewportPanInteraction } from '../../../features/viewport/interaction'

export type FeatureCompositionInput = {
  kernel: EditorKernel
  read: Editor['read']
  state: Editor['state']
  commands: Editor['commands']
  viewport: EditorViewportRuntime
  draw: DrawFeatureState
  nodeProjection: NodeProjectionRuntime
  edgeProjection: EdgeProjection
  mindmapDragProjection: MindmapDragProjectionStore
  contextMenu: ValueStore<ContextMenuView | null>
}

export type EditorFeatureRuntimes = {
  marquee: MarqueeInteraction
  draw: DrawInteraction
  transform: NodeTransformInteraction
  edgeConnect: EdgeConnectInteraction
  edgeEdit: EdgeEditInteraction
  mindmapDrag: MindmapDragInteraction
  selectionPress: SelectionPressInteraction
  context: ContextRuntime
  viewportPan: InteractionRegistration
  insertPreset: InteractionRegistration
  edgeHover: PassiveInputProcessor
}

export const createFeatureRuntimes = ({
  kernel,
  read,
  state,
  commands,
  viewport,
  draw: drawState,
  nodeProjection,
  edgeProjection,
  mindmapDragProjection,
  contextMenu
}: FeatureCompositionInput): EditorFeatureRuntimes => {
  const runtimeDeps = {
    commands,
    config: kernel.document.engine.config,
    read,
    state,
    viewport
  }

  const marquee = createMarqueeInteraction({
    read,
    viewport
  })
  const draw = createDrawInteraction({
    commands,
    read,
    viewport,
    internals: {
      projections: {
        model: {
          node: nodeProjection
        }
      }
    }
  })
  const transform = createNodeTransformInteraction({
    commands,
    read,
    viewport,
    internals: {
      projections: {
        model: {
          node: nodeProjection
        }
      },
      snap: kernel.spatial.snap
    }
  })
  const edgeConnect = createEdgeConnectInteraction({
    ...runtimeDeps,
    internals: {
      projections: {
        overlay: {
          edge: edgeProjection
        }
      },
      snap: kernel.spatial.snap
    }
  })
  const edgeEdit = createEdgeEditInteraction(
    {
      ...runtimeDeps,
      internals: {
        projections: {
          overlay: {
            edge: edgeProjection
          }
        },
        snap: kernel.spatial.snap
      }
    },
    edgeConnect
  )
  const mindmapDrag = createMindmapDragInteraction({
    ...runtimeDeps,
    internals: {
      projections: {
        overlay: {
          mindmapDrag: mindmapDragProjection
        }
      }
    }
  })
  const selectionPress = createSelectionPressInteraction(
    {
      ...runtimeDeps,
      interaction: kernel.interaction,
      internals: {
        projections: {
          model: {
            node: nodeProjection
          },
          overlay: {
            edge: edgeProjection
          }
        },
        pick: kernel.spatial.pick,
        snap: kernel.spatial.snap
      }
    },
    marquee
  )
  const context = createContextRuntime(
    {
      commands,
      read,
      state,
      registry: kernel.document.registry
    },
    contextMenu
  )

  return {
    marquee,
    draw,
    transform,
    edgeConnect,
    edgeEdit,
    mindmapDrag,
    selectionPress,
    context,
    viewportPan: createViewportPanInteraction({
      interaction: kernel.interaction,
      read,
      viewport,
      policy: kernel.config.inputPolicy
    }),
    insertPreset: createInsertPresetInteraction({
      commands,
      read
    }),
    edgeHover: createEdgeHoverProcessor({
      interaction: kernel.interaction,
      internals: {
        projections: {
          overlay: {
            edge: edgeProjection
          }
        },
        snap: kernel.spatial.snap
      }
    })
  }
}
