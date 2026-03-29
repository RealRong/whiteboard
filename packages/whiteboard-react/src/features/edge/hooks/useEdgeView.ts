import type { EdgeHandle } from '@whiteboard/core/edge'
import type { EdgeId } from '@whiteboard/core/types'
import { useMemo } from 'react'
import { useEditorRuntime } from '../../../runtime/hooks'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import { useSelection } from '../../node/selection'

export type EdgeView = NonNullable<
  ReturnType<ReturnType<typeof useEditor>['read']['edge']['view']['get']>
>

export type SelectedEdgeRoutePointView =
  | {
      key: string
      kind: 'anchor'
      edgeId: EdgeId
      index: number
      point: EdgeHandle['point']
      active: boolean
    }
  | {
      key: string
      kind: 'insert'
      edgeId: EdgeId
      insertIndex: number
      point: EdgeHandle['point']
      active: false
    }

export type SelectedEdgeView = {
  edgeId: EdgeId
  ends: EdgeView['ends']
  routePoints: readonly SelectedEdgeRoutePointView[]
}

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
  const edgeId = selection.kind === 'edge' && selection.items.count === 1
    ? selection.target.edgeId
    : undefined
  const entry = useEdgeView(edgeId)
  const emptyPatch = editor.host.edge.preview.emptyPatch
  const patch = useOptionalKeyedStoreValue(
    editor.host.edge.preview.patch,
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
