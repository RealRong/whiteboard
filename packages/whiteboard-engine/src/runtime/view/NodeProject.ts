import type { Query } from '@engine-types/instance/query'
import type { NodeViewItem } from '@engine-types/instance/view'
import type { Node, Point, Rect, Size } from '@whiteboard/core/types'

export type NodePreview = {
  position?: Point
  size?: Size
  rotation?: number
}

const getNodeRect = (query: Query, node: Node): Rect =>
  query.canvas.nodeRect(node.id)?.rect ?? {
    x: node.position.x,
    y: node.position.y,
    width: node.size?.width ?? 0,
    height: node.size?.height ?? 0
  }

export const projectNodeItem = (options: {
  node: Node
  query: Query
  preview?: NodePreview
  previous?: NodeViewItem
}): NodeViewItem => {
  const { node, query, previous, preview } = options
  const committedRect = getNodeRect(query, node)
  const position = preview?.position ?? node.position
  const size = preview?.size ?? node.size
  const rect = preview?.position || preview?.size
    ? {
      x: position.x,
      y: position.y,
      width: size?.width ?? committedRect.width,
      height: size?.height ?? committedRect.height
    }
    : committedRect
  const rotation =
    typeof preview?.rotation === 'number'
      ? preview.rotation
      : (
          typeof node.rotation === 'number'
            ? node.rotation
            : 0
        )
  const transformBase = `translate(${rect.x}px, ${rect.y}px)`

  if (
    previous &&
    previous.node === node &&
    previous.rect === rect &&
    previous.container.rotation === rotation &&
    previous.container.transformBase === transformBase
  ) {
    return previous
  }

  return {
    node,
    rect,
    container: {
      transformBase,
      rotation,
      transformOrigin: 'center center'
    }
  }
}
