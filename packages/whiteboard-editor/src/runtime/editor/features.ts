import type { ValueStore } from '@whiteboard/engine'
import { createDrawInputRuntime } from '../../features/draw/input'
import { createEdgeHoverProcessor } from '../../features/edge/hoverProcessor'
import { createEdgeInputRuntime } from '../../features/edge/input'
import type { EdgeProjection } from '../../features/edge/projection'
import { createEdgeConnectInteraction } from '../../features/edge/connect/interaction'
import { createMindmapDragInteraction } from '../../features/mindmap/drag/interaction'
import type { MindmapDragProjectionStore } from '../../features/mindmap/drag/projection'
import { createNodeTransformInteraction } from '../../features/node/transform/interaction'
import type { NodeProjectionRuntime } from '../../features/node/projection/store'
import { createSelectionPressRuntime } from '../../features/selection/gesture'
import { createMarqueeSession } from '../../features/selection/marquee'
import type {
  DrawFeatureState,
  EditorKernel,
  EditorViewportRuntime
} from '../../types/internal/editor'
import type { Editor } from '../../types/public/editor'
import {
  createContextRuntime,
  type ContextMenuView
} from '../context'
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
} from '../input/interactionStart'
import { createViewportPanDriver } from '../../features/viewport/panDriver'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

export const createFeatures = ({
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
}: {
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
}): {
  capsules: readonly EditorFeatureCapsule[]
} => {
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

  const capsules: readonly EditorFeatureCapsule[] = [
    {
      key: 'viewport',
      drivers: [
        createViewportPanDriver({
          interaction: kernel.interaction,
          read,
          viewport,
          policy: kernel.config.inputPolicy
        })
      ]
    },
    {
      key: 'insert',
      drivers: [
        createInsertPresetDriver({
          commands,
          read
        })
      ]
    },
    {
      key: 'draw',
      drivers: [
        createDrawEraseDriver(drawInput),
        createDrawStrokeDriver(drawInput)
      ],
      read: {
        draw: {
          preferences: draw.store
        }
      },
      projections: {
        overlay: {
          draw: drawInput.preview
        }
      },
      projection: {
        draw: drawInput.preview
      },
      lifecycle: {
        reset: drawInput.cancel,
        dispose: drawInput.cancel
      }
    },
    {
      key: 'node',
      drivers: [
        createNodeTransformDriver(transform)
      ],
      projections: {
        model: {
          node: nodeProjection
        }
      },
      lifecycle: {
        reset: () => {
          transform.cancel()
          nodeProjection.clear()
        },
        dispose: () => {
          transform.cancel()
          nodeProjection.clear()
        }
      }
    },
    {
      key: 'selection',
      drivers: [
        createSelectionPressDriver(selectionPress)
      ],
      projections: {
        overlay: {
          marquee: {
            rect: marquee.rect,
            match: marquee.match
          }
        }
      },
      projection: {
        marquee: {
          rect: marquee.rect,
          match: marquee.match
        }
      },
      lifecycle: {
        reset: () => {
          selectionPress.cancel()
          marquee.cancel()
        },
        dispose: () => {
          selectionPress.cancel()
          marquee.cancel()
        }
      }
    },
    {
      key: 'edge',
      drivers: [
        createEdgeCreateDriver(edgeConnect),
        createEdgeReconnectDriver(edgeConnect),
        createEdgeRouteDriver(edgeInput),
        createEdgeBodyDriver(edgeInput)
      ],
      passive: [
        createEdgeHoverProcessor({
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
      ],
      projections: {
        overlay: {
          edge: edgeProjection
        }
      },
      projection: {
        edge: {
          patch: {
            get: edgeProjection.patch.get,
            subscribe: edgeProjection.patch.subscribe
          },
          hint: {
            get: edgeProjection.hint.get,
            subscribe: edgeProjection.hint.subscribe
          },
          emptyPatch: edgeProjection.emptyPatch
        }
      },
      lifecycle: {
        reset: () => {
          edgeInput.cancel()
          edgeConnect.cancel()
          edgeProjection.clear()
        },
        dispose: () => {
          edgeInput.cancel()
          edgeConnect.cancel()
          edgeProjection.clear()
        }
      }
    },
    {
      key: 'mindmap',
      drivers: [
        createMindmapDragDriver(mindmapDrag)
      ],
      projections: {
        overlay: {
          mindmapDrag: mindmapDragProjection
        }
      },
      projection: {
        mindmapDrag: mindmapDragProjection
      },
      lifecycle: {
        reset: mindmapDrag.cancel,
        dispose: mindmapDrag.cancel
      }
    },
    {
      key: 'snap',
      projections: {
        overlay: {
          snap: kernel.spatial.snap.node.guides
        }
      },
      projection: {
        snap: kernel.spatial.snap.node.guides
      },
      lifecycle: {
        reset: () => {
          kernel.spatial.snap.node.clear()
        },
        dispose: () => {
          kernel.spatial.snap.node.clear()
        }
      }
    },
    {
      key: 'context',
      read: {
        context: {
          menu: context.menu,
          selection: context.selection
        }
      },
      commands: {
        context: {
          open: context.open,
          dismiss: context.dismiss
        }
      },
      lifecycle: {
        reset: context.clear,
        dispose: context.clear
      }
    }
  ]

  return {
    capsules
  }
}
