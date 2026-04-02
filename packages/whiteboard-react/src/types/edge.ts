import type { EdgeHandle } from '@whiteboard/core/edge'
import type { EdgeId } from '@whiteboard/core/types'
import type { Editor } from '../boardRuntime'

export type EdgeResolved = NonNullable<
  ReturnType<Editor['read']['edge']['resolved']['get']>
>

export type EdgeState = ReturnType<
  Editor['read']['edge']['state']['get']
>

export type EdgeView = EdgeResolved & {
  edge: NonNullable<
    ReturnType<Editor['read']['edge']['item']['get']>
  >['edge']
}

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
