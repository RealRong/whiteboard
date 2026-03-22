import { getEdgePath } from '@whiteboard/core/edge'
import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { useMemo } from 'react'
import {
  useInternalInstance,
  useSelection
} from '../../../runtime/hooks'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import { EMPTY_PATCH } from '../preview'

export type EdgeView = {
  edge: EdgeItem['edge']
  ends: EdgeItem['ends']
}

export type SelectedEdgePathPointView =
  | {
      key: string
      kind: 'anchor'
      edgeId: EdgeId
      index: number
      point: Point
      active: boolean
    }
  | {
      key: string
      kind: 'insert'
      edgeId: EdgeId
      insertIndex: number
      point: Point
      active: false
    }

export type SelectedEdgeView = {
  edgeId: EdgeId
  ends: EdgeView['ends']
  pathPoints: readonly SelectedEdgePathPointView[]
}

export const useEdgeView = (
  edgeId: EdgeId | undefined
): EdgeView | undefined => {
  const instance = useInternalInstance()
  const entry = useOptionalKeyedStoreValue(
    instance.read.edge.item,
    edgeId,
    undefined
  )

  return useMemo(
    () => {
      if (!entry) {
        return undefined
      }

      return {
        edge: entry.edge,
        ends: entry.ends
      }
    },
    [entry]
  )
}

export const useSelectedEdgeView = (): SelectedEdgeView | undefined => {
  const instance = useInternalInstance()
  const edgeId = useSelection().target.edgeId
  const entry = useEdgeView(edgeId)
  const patch = useOptionalKeyedStoreValue(
    instance.internals.edge.preview.patch,
    edgeId,
    EMPTY_PATCH
  )

  return useMemo(() => {
    if (!edgeId || !entry) {
      return undefined
    }

    const edge = entry.edge
    const points = edge.path?.points ?? []
    const pathPoints: SelectedEdgePathPointView[] = []
    const path = getEdgePath({
      edge,
      source: {
        point: entry.ends.source.point,
        side: entry.ends.source.anchor?.side
      },
      target: {
        point: entry.ends.target.point,
        side: entry.ends.target.anchor?.side
      }
    })

    points.forEach((point, index) => {
      pathPoints.push({
        key: `${edge.id}-anchor-${index}`,
        kind: 'anchor',
        edgeId: edge.id,
        index,
        point,
        active: patch.activePathIndex === index
      })
    })

    path.segments.forEach((segment, index) => {
      pathPoints.push({
        key: `${edge.id}-insert-${index}`,
        kind: 'insert',
        edgeId: edge.id,
        insertIndex: segment.insertIndex,
        point: segment.insertPoint ?? {
          x: (segment.from.x + segment.to.x) / 2,
          y: (segment.from.y + segment.to.y) / 2
        },
        active: false
      })
    })

    return {
      edgeId,
      ends: entry.ends,
      pathPoints
    }
  }, [patch.activePathIndex, edgeId, entry])
}
