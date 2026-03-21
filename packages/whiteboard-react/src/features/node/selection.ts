import { rectContainsRotatedRect } from '@whiteboard/core/geometry'
import type { NodeRectHitOptions } from '@whiteboard/core/node'
import type { CanvasNode } from '@whiteboard/core/read'
import type { Rect } from '@whiteboard/core/types'
import type { InternalInstance } from '../../runtime/instance'
import { matchDrawRect } from '../draw/stroke'

const matchesPathNode = ({
  entry,
  rect,
  match
}: {
  entry: CanvasNode
  rect: Rect
  match: 'touch' | 'contain'
}) => {
  switch (entry.node.type) {
    case 'draw':
      return matchDrawRect({
        node: entry.node,
        rect: entry.rect,
        queryRect: rect,
        mode: match
      })
    default:
      return match === 'contain'
        ? rectContainsRotatedRect(rect, entry.rect, entry.rotation)
        : true
  }
}

const matchesNodeInRect = ({
  instance,
  entry,
  rect,
  match
}: {
  instance: InternalInstance
  entry: CanvasNode
  rect: Rect
  match: 'touch' | 'contain'
}) => {
  const definition = instance.registry.get(entry.node.type)
  if (definition?.hit === 'path') {
    return matchesPathNode({
      entry,
      rect,
      match
    })
  }

  return match === 'contain'
    ? rectContainsRotatedRect(rect, entry.rect, entry.rotation)
    : true
}

export const matchNodeIdsInRect = (
  instance: InternalInstance,
  rect: Rect,
  options?: NodeRectHitOptions
) => {
  const match = options?.match ?? 'touch'
  const candidates = instance.read.index.node.idsInRect(rect, {
    ...options,
    match: match === 'contain' ? 'touch' : match
  })

  return candidates.filter((nodeId) => {
    const entry = instance.read.index.node.get(nodeId)
    if (!entry) {
      return false
    }
    return matchesNodeInRect({
      instance,
      entry,
      rect,
      match
    })
  })
}
