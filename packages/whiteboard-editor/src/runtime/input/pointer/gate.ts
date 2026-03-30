import { isPointInRect } from '@whiteboard/core/geometry'
import {
  ROOT_FRAME_SCOPE,
  isEdgeInFrameScope,
  isNodeInFrameScope,
  type FrameScope
} from '@whiteboard/core/document'
import type { Editor } from '../../../types/public/editor'
import type { PointerPick } from '../../pick'

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
  if (!frame.id) {
    return {
      frame,
      exit: false
    }
  }

  const frameNode = editor.read.node.item.get(frame.id)?.node
  if (!frameNode || editor.read.node.role(frameNode) !== 'frame') {
    return {
      frame: ROOT_FRAME_SCOPE,
      exit: true
    }
  }

  const frameRect = editor.read.index.node.get(frame.id)?.rect

  switch (start.pick.kind) {
    case 'background':
      return frameRect && isPointInRect(start.point.world, frameRect)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME_SCOPE,
            exit: true
          }
    case 'selection-box':
      return {
        frame,
        exit: false
      }
    case 'node':
      if (start.pick.id === frame.id) {
        return {
          frame,
          exit: false
        }
      }

      return isNodeInFrameScope(frame, start.pick.id)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME_SCOPE,
            exit: true
          }
    case 'mindmap':
      return isNodeInFrameScope(frame, start.pick.treeId)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME_SCOPE,
            exit: true
          }
    case 'edge': {
      const edge = editor.read.edge.item.get(start.pick.id)?.edge
      if (!edge) {
        return {
          frame: ROOT_FRAME_SCOPE,
          exit: true
        }
      }

      return isEdgeInFrameScope(frame, edge)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME_SCOPE,
            exit: true
          }
    }
  }
}
