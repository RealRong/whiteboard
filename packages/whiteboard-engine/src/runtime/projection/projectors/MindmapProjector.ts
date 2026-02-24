import type { Node, NodeId } from '@whiteboard/core/types'
import type { ProjectionMindmapSlice } from '@engine-types/projection'
import { EMPTY_NODE_IDS } from '../cache/shared'

type MindmapProjectInput = {
  visibleNodes: Node[]
  previous: ProjectionMindmapSlice
}

const isSameIdOrder = (left: readonly NodeId[], right: readonly NodeId[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const deriveRoots = (visibleNodes: Node[]): NodeId[] => {
  const roots = visibleNodes
    .filter((node) => node.type === 'mindmap')
    .map((node) => node.id)
  return roots.length ? roots : EMPTY_NODE_IDS
}

export class MindmapProjector {
  project = ({
    visibleNodes,
    previous
  }: MindmapProjectInput): ProjectionMindmapSlice => {
    const nextRoots = deriveRoots(visibleNodes)
    if (isSameIdOrder(previous.roots, nextRoots)) return previous
    return {
      roots: nextRoots
    }
  }
}
