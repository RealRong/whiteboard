import type { EditorProjectionGraph } from '../../types/internal/editor'
import type { EditorProjection } from '../../types/public/editor'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

const mergeProjectionAugment = (
  projection: EditorProjection,
  augment: Partial<EditorProjection>
) => {
  Object.assign(projection, augment)
}

export const composeProjection = ({
  projections,
  capsules
}: {
  projections: EditorProjectionGraph
  capsules: readonly EditorFeatureCapsule[]
}): EditorProjection => {
  const projection: EditorProjection = {
    marquee: projections.overlay.marquee,
    draw: projections.overlay.draw,
    edge: {
      patch: {
        get: projections.overlay.edge.patch.get,
        subscribe: projections.overlay.edge.patch.subscribe
      },
      hint: {
        get: projections.overlay.edge.hint.get,
        subscribe: projections.overlay.edge.hint.subscribe
      },
      emptyPatch: projections.overlay.edge.emptyPatch
    },
    mindmapDrag: projections.overlay.mindmapDrag,
    snap: projections.overlay.snap
  }

  capsules.forEach((capsule) => {
    if (!capsule.projection) {
      return
    }

    mergeProjectionAugment(projection, capsule.projection)
  })

  return projection
}
