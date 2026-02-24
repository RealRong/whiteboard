import type { Query } from '@engine-types/instance/query'
import type { NodeViewItem } from '@engine-types/instance/view'
import type { Node, Rect } from '@whiteboard/core/types'

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
  rotationOverride?: number
  previous?: NodeViewItem
}): NodeViewItem => {
  const { node, query, previous, rotationOverride } = options
  const rect = getNodeRect(query, node)
  const rotation =
    typeof rotationOverride === 'number'
      ? rotationOverride
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
