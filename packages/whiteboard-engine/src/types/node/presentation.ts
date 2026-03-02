import type { Node, Rect } from '@whiteboard/core/types'
import type { NodeContainerProps, NodeDefinition, NodeRenderProps } from './registry'
import type { RefLike } from '../ui/model'

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
