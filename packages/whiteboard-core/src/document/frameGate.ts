import { isPointInRect } from '../geometry'
import type { Edge, NodeId, Point, Rect } from '../types'
import {
  ROOT_FRAME_SCOPE,
  isEdgeInFrameScope,
  isNodeInFrameScope,
  type FrameScope
} from './frameScope'

export type FrameGateSubject =
  | {
      kind: 'background'
      pointWorld: Point
    }
  | { kind: 'selection-box' }
  | {
      kind: 'node'
      nodeId: NodeId
    }
  | {
      kind: 'mindmap'
      treeId: NodeId
    }
  | {
      kind: 'edge'
      edge?: Pick<Edge, 'source' | 'target'>
    }

export type FrameGateDecision = {
  frame: FrameScope
  exit: boolean
}

export const resolveFrameGateDecision = ({
  frame,
  frameValid,
  frameRect,
  subject
}: {
  frame: FrameScope
  frameValid: boolean
  frameRect?: Rect
  subject: FrameGateSubject
}): FrameGateDecision => {
  if (!frame.id) {
    return {
      frame,
      exit: false
    }
  }

  if (!frameValid) {
    return {
      frame: ROOT_FRAME_SCOPE,
      exit: true
    }
  }

  switch (subject.kind) {
    case 'background':
      return frameRect && isPointInRect(subject.pointWorld, frameRect)
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
      if (subject.nodeId === frame.id) {
        return {
          frame,
          exit: false
        }
      }

      return isNodeInFrameScope(frame, subject.nodeId)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME_SCOPE,
            exit: true
          }
    case 'mindmap':
      return isNodeInFrameScope(frame, subject.treeId)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME_SCOPE,
            exit: true
          }
    case 'edge':
      return subject.edge && isEdgeInFrameScope(frame, subject.edge)
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
