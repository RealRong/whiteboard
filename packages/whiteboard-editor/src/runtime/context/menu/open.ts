import { isPointInRect } from '@whiteboard/core/geometry'
import {
  isEdgeInFrameScope,
  isNodeInFrameScope
} from '@whiteboard/core/document'
import type { Editor } from '../../../types/public/editor'
import type { PointerPick } from '../../pick'
import {
  readContextTarget,
  type ContextTarget
} from './target'

export type ContextOpen = {
  target: ContextTarget
  leaveFrame: boolean
}

export const readContextOpen = (
  editor: Pick<Editor, 'read' | 'state'>,
  input: PointerPick
): ContextOpen | undefined => {
  const frame = editor.state.frame.get()
  const selection = editor.read.selection.get()
  const world = input.point.world
  const pick = input.pick
  const target = readContextTarget({
    pick,
    world,
    selectionNodeIds: selection.target.nodeIds,
    selectionNodeSet: selection.target.nodeSet,
    selectionCount: selection.items.count
  })

  if (target.kind === 'nodes') {
    return {
      target,
      leaveFrame: pick.kind === 'selection-box'
        ? false
        : pick.kind === 'node'
          ? !isNodeInFrameScope(frame, pick.id)
          : false
    }
  }

  if (target.kind === 'node') {
    return {
      target,
      leaveFrame: !isNodeInFrameScope(frame, target.nodeId)
    }
  }

  if (target.kind === 'edge') {
    const entry = editor.read.edge.item.get(target.edgeId)
    if (!entry) {
      return undefined
    }

    return {
      target,
      leaveFrame: !isEdgeInFrameScope(frame, entry.edge)
    }
  }

  const activeRect = frame.id
    ? editor.read.index.node.get(frame.id)?.rect
    : undefined
  const insideActiveFrame = Boolean(activeRect && isPointInRect(world, activeRect))

  return {
    target: {
      kind: 'canvas',
      world
    },
    leaveFrame: Boolean(frame.id && !insideActiveFrame)
  }
}
