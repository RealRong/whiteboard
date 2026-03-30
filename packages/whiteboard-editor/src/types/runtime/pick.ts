import type { TransformHandle } from '@whiteboard/core/node'
import type {
  EdgeAnchor,
  EdgeId,
  MindmapNodeId,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { EditField } from '../../runtime/edit'

export type EditorPick =
  | { kind: 'background' }
  | {
      kind: 'selection-box'
      part: 'body' | 'transform'
      handle?: {
        id: TransformHandle['id']
        kind: TransformHandle['kind']
        direction?: TransformHandle['direction']
      }
    }
  | {
      kind: 'node'
      id: NodeId
      part: 'body' | 'shell' | 'transform' | 'connect'
      handle?: {
        id: TransformHandle['id']
        kind: TransformHandle['kind']
        direction?: TransformHandle['direction']
      }
      side?: EdgeAnchor['side']
    }
  | {
      kind: 'edge'
      id: EdgeId
      part: 'body' | 'end' | 'path'
      end?: 'source' | 'target'
      index?: number
      insert?: number
    }
  | {
      kind: 'mindmap'
      treeId: NodeId
      nodeId: MindmapNodeId
    }

export type PointerPick = {
  pick: EditorPick
  point: {
    client: Point
    screen: Point
    world: Point
  }
  field?: EditField
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
}
