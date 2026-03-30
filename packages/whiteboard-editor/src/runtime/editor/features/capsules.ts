import type { EditorFeatureCapsule } from '../../../types/runtime/editor/capsule'
import { createFeatureRuntimes, type FeatureCompositionInput } from './runtimes'

export const createFeatureCapsules = (
  input: FeatureCompositionInput
): {
  capsules: readonly EditorFeatureCapsule[]
} => {
  const runtimes = createFeatureRuntimes(input)
  const {
    kernel,
    read,
    commands,
    draw,
    nodeProjection,
    edgeProjection,
    mindmapDragProjection
  } = input

  const capsules: readonly EditorFeatureCapsule[] = [
    {
      key: 'viewport',
      drivers: [
        runtimes.viewportPanDriver
      ]
    },
    {
      key: 'insert',
      drivers: [
        runtimes.insertPresetDriver
      ]
    },
    {
      key: 'draw',
      drivers: [
        runtimes.drawEraseDriver,
        runtimes.drawStrokeDriver
      ],
      read: {
        draw: {
          preferences: draw.store
        }
      },
      projections: {
        overlay: {
          draw: runtimes.drawInput.preview
        }
      },
      projection: {
        draw: runtimes.drawInput.preview
      },
      lifecycle: {
        reset: runtimes.drawInput.cancel,
        dispose: runtimes.drawInput.cancel
      }
    },
    {
      key: 'node',
      drivers: [
        runtimes.nodeTransformDriver
      ],
      projections: {
        model: {
          node: nodeProjection
        }
      },
      lifecycle: {
        reset: () => {
          runtimes.transform.cancel()
          nodeProjection.clear()
        },
        dispose: () => {
          runtimes.transform.cancel()
          nodeProjection.clear()
        }
      }
    },
    {
      key: 'selection',
      drivers: [
        runtimes.selectionPressDriver
      ],
      projections: {
        overlay: {
          marquee: {
            rect: runtimes.marquee.rect,
            match: runtimes.marquee.match
          }
        }
      },
      projection: {
        marquee: {
          rect: runtimes.marquee.rect,
          match: runtimes.marquee.match
        }
      },
      lifecycle: {
        reset: () => {
          runtimes.selectionPress.cancel()
          runtimes.marquee.cancel()
        },
        dispose: () => {
          runtimes.selectionPress.cancel()
          runtimes.marquee.cancel()
        }
      }
    },
    {
      key: 'edge',
      drivers: [
        runtimes.edgeCreateDriver,
        runtimes.edgeReconnectDriver,
        runtimes.edgeRouteDriver,
        runtimes.edgeBodyDriver
      ],
      passive: [
        runtimes.edgeHover
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
          runtimes.edgeInput.cancel()
          runtimes.edgeConnect.cancel()
          edgeProjection.clear()
        },
        dispose: () => {
          runtimes.edgeInput.cancel()
          runtimes.edgeConnect.cancel()
          edgeProjection.clear()
        }
      }
    },
    {
      key: 'mindmap',
      drivers: [
        runtimes.mindmapDragDriver
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
        reset: runtimes.mindmapDrag.cancel,
        dispose: runtimes.mindmapDrag.cancel
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
          menu: runtimes.context.menu,
          selection: runtimes.context.selection
        }
      },
      commands: {
        context: {
          open: runtimes.context.open,
          dismiss: runtimes.context.dismiss
        }
      },
      lifecycle: {
        reset: runtimes.context.clear,
        dispose: runtimes.context.clear
      }
    }
  ]

  return {
    capsules
  }
}
