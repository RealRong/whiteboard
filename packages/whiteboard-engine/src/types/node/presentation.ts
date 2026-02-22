import type { Node, Rect } from '@whiteboard/core/types'
import type { NodeContainerProps, NodeDefinition, NodeRenderProps } from './registry'
import type { RefLike } from '../ui'

export type NodePresentationOptions = {
  node: Node
  containerRef?: RefLike<HTMLDivElement | null>
}

export type NodePresentation = {
  rect: Rect
  definition?: NodeDefinition
  activeTool: 'select' | 'edge'
  selected: boolean
  hovered: boolean
  canRotate: boolean
  containerProps: NodeContainerProps
  renderProps: NodeRenderProps
}
