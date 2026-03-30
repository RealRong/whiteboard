import type { EdgeId } from '@whiteboard/core/types'
import { useMemo } from 'react'
import { useEditorRuntime } from '../../../runtime/hooks'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import type {
  EdgeView,
  SelectedEdgeRoutePointView,
  SelectedEdgeView
} from '../../../types/edge'
import { useSelection } from '../../node/selection'

export const useEdgeView = (
  edgeId: EdgeId | undefined
): EdgeView | undefined => {
  const editor = useEditorRuntime()

  return useOptionalKeyedStoreValue(
    editor.read.edge.view,
    edgeId,
    undefined
  )
}

export const useSelectedEdgeView = (): SelectedEdgeView | undefined => {
  const editor = useEditorRuntime()
  const selection = useSelection()
  const edgeId = selection.summary.kind === 'edge' && selection.summary.items.count === 1
    ? selection.target.edgeId
    : undefined
  const entry = useEdgeView(edgeId)
  const emptyPatch = editor.projection.edge.emptyPatch
  const patch = useOptionalKeyedStoreValue(
    editor.projection.edge.patch,
    edgeId,
    emptyPatch
  )

  return useMemo(() => {
    if (!edgeId || !entry) {
      return undefined
    }

    const routePoints: SelectedEdgeRoutePointView[] = entry.handles.flatMap<SelectedEdgeRoutePointView>((handle) => {
      if (handle.kind === 'anchor') {
        return [{
          key: `${edgeId}:anchor:${handle.index}`,
          kind: 'anchor' as const,
          edgeId,
          index: handle.index,
          point: handle.point,
          active: patch.activeRouteIndex === handle.index
        }]
      }

      if (handle.kind === 'insert') {
        return [{
          key: `${edgeId}:insert:${handle.insertIndex}`,
          kind: 'insert' as const,
          edgeId,
          insertIndex: handle.insertIndex,
          point: handle.point,
          active: false as const
        }]
      }

      return []
    })

    return {
      edgeId,
      ends: entry.ends,
      routePoints
    }
  }, [edgeId, entry, patch.activeRouteIndex])
}

export type {
  EdgeView,
  SelectedEdgeRoutePointView,
  SelectedEdgeView
} from '../../../types/edge'
