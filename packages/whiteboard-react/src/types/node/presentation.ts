import type { Node, Rect } from '@whiteboard/core'
import type { Ref } from 'react'
import type { NodeContainerProps, NodeDefinition, NodeRenderProps } from './registry'

export type UseNodePresentationOptions = {
  node: Node
  containerRef?: Ref<HTMLDivElement>
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
