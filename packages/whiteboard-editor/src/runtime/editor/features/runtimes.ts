import type { ValueStore } from '@whiteboard/engine'
import type { InteractionDriver } from '../../interaction'
import type { PassiveInputProcessor } from '../../input/passive'
import { createDrawInputRuntime } from '../../../features/draw/input'
import { createEdgeHoverProcessor } from '../../../features/edge/hoverProcessor'
import { createEdgeInputRuntime } from '../../../features/edge/input'
import type { EdgeProjection } from '../../../features/edge/projection'
import { createEdgeConnectInteraction } from '../../../features/edge/connect/interaction'
import { createMindmapDragInteraction } from '../../../features/mindmap/drag/interaction'
import type { MindmapDragProjectionStore } from '../../../features/mindmap/drag/projection'
import { createNodeTransformInteraction } from '../../../features/node/transform/interaction'
import type { NodeProjectionRuntime } from '../../../features/node/projection/store'
import { createSelectionPressRuntime } from '../../../features/selection/gesture'
import { createMarqueeSession } from '../../../features/selection/marquee'
import type { DrawInputRuntime } from '../../../features/draw/input'
import type { EdgeInputRuntime } from '../../../features/edge/input'
import type { EdgeConnectInteraction } from '../../../features/edge/connect/interaction'
import type { MindmapDragInteraction } from '../../../features/mindmap/drag/interaction'
import type { NodeTransformInteraction } from '../../../features/node/transform/interaction'
import type { SelectionPressRuntime } from '../../../features/selection/gesture'
import type { MarqueeSession } from '../../../features/selection/marquee'
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
import {
  createDrawEraseDriver,
  createDrawStrokeDriver,
  createEdgeBodyDriver,
  createEdgeCreateDriver,
  createEdgeReconnectDriver,
  createEdgeRouteDriver,
  createInsertPresetDriver,
  createMindmapDragDriver,
  createNodeTransformDriver,
  createSelectionPressDriver
} from '../../input/drivers'
import { createViewportPanDriver } from '../../../features/viewport/panDriver'

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
  marquee: MarqueeSession
  drawInput: DrawInputRuntime
  transform: NodeTransformInteraction
  edgeConnect: EdgeConnectInteraction
  edgeInput: EdgeInputRuntime
  mindmapDrag: MindmapDragInteraction
  selectionPress: SelectionPressRuntime
  context: ContextRuntime
  viewportPanDriver: InteractionDriver
  insertPresetDriver: InteractionDriver
  drawEraseDriver: InteractionDriver
  drawStrokeDriver: InteractionDriver
  nodeTransformDriver: InteractionDriver
  selectionPressDriver: InteractionDriver
  edgeCreateDriver: InteractionDriver
  edgeReconnectDriver: InteractionDriver
  edgeRouteDriver: InteractionDriver
  edgeBodyDriver: InteractionDriver
  edgeHover: PassiveInputProcessor
  mindmapDragDriver: InteractionDriver
}

export const createFeatureRuntimes = ({
  kernel,
  read,
  state,
  commands,
  viewport,
  draw,
  nodeProjection,
  edgeProjection,
  mindmapDragProjection,
  contextMenu
}: FeatureCompositionInput): EditorFeatureRuntimes => {
  const runtimeDeps = {
    commands,
    config: kernel.document.engine.config,
    interaction: kernel.interaction,
    read,
    state,
    viewport
  }

  const marquee = createMarqueeSession({
    interaction: kernel.interaction,
    read,
    viewport
  })
  const drawInput = createDrawInputRuntime({
    commands,
    interaction: kernel.interaction,
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
    interaction: kernel.interaction,
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
  const edgeInput = createEdgeInputRuntime(
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
  const selectionPress = createSelectionPressRuntime(
    {
      ...runtimeDeps,
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
    drawInput,
    transform,
    edgeConnect,
    edgeInput,
    mindmapDrag,
    selectionPress,
    context,
    viewportPanDriver: createViewportPanDriver({
      interaction: kernel.interaction,
      read,
      viewport,
      policy: kernel.config.inputPolicy
    }),
    insertPresetDriver: createInsertPresetDriver({
      commands,
      read
    }),
    drawEraseDriver: createDrawEraseDriver(drawInput),
    drawStrokeDriver: createDrawStrokeDriver(drawInput),
    nodeTransformDriver: createNodeTransformDriver(transform),
    selectionPressDriver: createSelectionPressDriver(selectionPress),
    edgeCreateDriver: createEdgeCreateDriver(edgeConnect),
    edgeReconnectDriver: createEdgeReconnectDriver(edgeConnect),
    edgeRouteDriver: createEdgeRouteDriver(edgeInput),
    edgeBodyDriver: createEdgeBodyDriver(edgeInput),
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
    }),
    mindmapDragDriver: createMindmapDragDriver(mindmapDrag)
  }
}
