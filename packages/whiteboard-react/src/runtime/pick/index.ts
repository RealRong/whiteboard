import type { TransformHandle } from '@whiteboard/core/node'
import type {
  EdgeAnchor,
  EdgeId,
  MindmapNodeId,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { EditField } from '../edit'

export type Pick =
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
  pick: Pick
  point: {
    client: Point
    screen: Point
    world: Point
  }
  element: Element | null
  field?: EditField
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
}

export type PickRuntime = {
  bind: (element: Element, pick: Pick) => () => void
  element: (element: Element | null, within?: Element) => Pick | undefined
}

type PickEntry = {
  pick: Pick
}

export const toPickKey = (
  pick: Pick
) => {
  switch (pick.kind) {
    case 'background':
      return 'background'
    case 'selection-box':
      return [
        'selection-box',
        pick.part,
        pick.handle?.id ?? '',
        pick.handle?.direction ?? ''
      ].join(':')
    case 'node':
      return [
        'node',
        pick.id,
        pick.part,
        pick.handle?.id ?? '',
        pick.side ?? ''
      ].join(':')
    case 'edge':
      return [
        'edge',
        pick.id,
        pick.part,
        pick.end ?? '',
        pick.index ?? '',
        pick.insert ?? ''
      ].join(':')
    case 'mindmap':
      return [
        'mindmap',
        pick.treeId,
        pick.nodeId
      ].join(':')
  }
}

export const createPickRuntime = (): PickRuntime => {
  const picks = new WeakMap<Element, PickEntry>()

  return {
    bind: (element, pick) => {
      const entry: PickEntry = {
        pick
      }
      picks.set(element, entry)

      return () => {
        if (picks.get(element) === entry) {
          picks.delete(element)
        }
      }
    },
    element: (element, within) => {
      let current = element

      while (current) {
        const entry = picks.get(current)
        if (entry) {
          return entry.pick
        }

        if (within && current === within) {
          break
        }

        current = current.parentElement
      }

      return undefined
    }
  }
}
