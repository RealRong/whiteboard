import {
  resolveFrameGateDecision,
  type FrameScope
} from '@whiteboard/core/document'
import type { Editor } from '../../../types/public/editor'
import type { PointerPick } from '../../pick'

const toFrameGateSubject = (
  editor: Pick<Editor, 'read'>,
  start: {
    pick: PointerPick['pick']
    point: PointerPick['point']
  }
) => {
  switch (start.pick.kind) {
    case 'background':
      return {
        kind: 'background' as const,
        pointWorld: start.point.world
      }
    case 'selection-box':
      return {
        kind: 'selection-box' as const
      }
    case 'node':
      return {
        kind: 'node' as const,
        nodeId: start.pick.id
      }
    case 'mindmap':
      return {
        kind: 'mindmap' as const,
        treeId: start.pick.treeId
      }
    case 'edge':
      return {
        kind: 'edge' as const,
        edge: editor.read.edge.item.get(start.pick.id)?.edge
      }
  }
}

export const resolvePointerFrameGate = (
  editor: Pick<Editor, 'read'>,
  start: {
    frame: FrameScope
    pick: PointerPick['pick']
    point: PointerPick['point']
  }
): {
  frame: FrameScope
  exit: boolean
} => {
  const frame = start.frame
  const frameNode = frame.id
    ? editor.read.node.item.get(frame.id)?.node
    : undefined
  return resolveFrameGateDecision({
    frame,
    frameValid: Boolean(frameNode && editor.read.node.role(frameNode) === 'frame'),
    frameRect: frame.id ? editor.read.index.node.get(frame.id)?.rect : undefined,
    subject: toFrameGateSubject(editor, start)
  })
}
