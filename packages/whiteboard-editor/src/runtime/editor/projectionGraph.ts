import type { EditorProjectionGraph } from '../../types/internal/editor'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

const requireProjection = <Value,>(
  value: Value | undefined,
  key: string
): Value => {
  if (value !== undefined) {
    return value
  }

  throw new Error(`[whiteboard-editor] missing projection contribution: ${key}`)
}

export const createProjectionGraph = (
  capsules: readonly EditorFeatureCapsule[]
): EditorProjectionGraph => {
  const model = capsules.reduce<Partial<EditorProjectionGraph['model']>>(
    (next, capsule) => ({
      ...next,
      ...capsule.projections?.model
    }),
    {}
  )
  const overlay = capsules.reduce<Partial<EditorProjectionGraph['overlay']>>(
    (next, capsule) => ({
      ...next,
      ...capsule.projections?.overlay
    }),
    {}
  )

  return {
    model: {
      node: requireProjection(model.node, 'model.node')
    },
    overlay: {
      marquee: requireProjection(overlay.marquee, 'overlay.marquee'),
      draw: requireProjection(overlay.draw, 'overlay.draw'),
      edge: requireProjection(overlay.edge, 'overlay.edge'),
      mindmapDrag: requireProjection(overlay.mindmapDrag, 'overlay.mindmapDrag'),
      snap: requireProjection(overlay.snap, 'overlay.snap')
    }
  }
}
