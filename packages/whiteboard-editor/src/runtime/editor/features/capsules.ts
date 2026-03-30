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
      interactions: [
        runtimes.viewportPan
      ]
    },
    {
      key: 'insert',
      interactions: [
        runtimes.insertPreset
      ]
    },
    {
      key: 'draw',
      interactions: [
        ...runtimes.draw.interactions
      ],
      read: {
        draw: {
          preferences: draw.store
        }
      },
      projections: {
        overlay: {
          draw: runtimes.draw.preview
        }
      },
      projection: {
        draw: runtimes.draw.preview
      },
      lifecycle: {
        reset: runtimes.draw.clear,
        dispose: runtimes.draw.clear
      }
    },
    {
      key: 'node',
      interactions: [
        runtimes.transform.interaction
      ],
      projections: {
        model: {
          node: nodeProjection
        }
      },
      lifecycle: {
        reset: () => {
          runtimes.transform.clear()
          nodeProjection.clear()
        },
        dispose: () => {
          runtimes.transform.clear()
          nodeProjection.clear()
        }
      }
    },
    {
      key: 'selection',
      interactions: [
        runtimes.selectionPress.interaction
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
          runtimes.selectionPress.clear()
        },
        dispose: () => {
          runtimes.selectionPress.clear()
        }
      }
    },
    {
      key: 'edge',
      interactions: [
        runtimes.edgeConnect.create,
        runtimes.edgeConnect.reconnect,
        runtimes.edgeEdit.route,
        runtimes.edgeEdit.body
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
          runtimes.edgeEdit.clear()
        },
        dispose: () => {
          runtimes.edgeEdit.clear()
        }
      }
    },
    {
      key: 'mindmap',
      interactions: [
        runtimes.mindmapDrag.interaction
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
        reset: runtimes.mindmapDrag.clear,
        dispose: runtimes.mindmapDrag.clear
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
