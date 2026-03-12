import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import type { CSSProperties, PointerEventHandler, ReactNode, Ref } from 'react'
import type { Commands, EngineRead } from '@whiteboard/engine'

export type NodeContainerProps = {
  rect: Rect
  nodeId: NodeId
  selected: boolean
  style?: CSSProperties
  ref?: Ref<HTMLDivElement>
  onPointerDown?: PointerEventHandler<HTMLDivElement>
}

export type NodeRenderProps = {
  read: Pick<EngineRead, 'index'>
  commands: Commands
  node: Node
  rect: Rect
  selected: boolean
  hovered: boolean
  containerProps?: NodeContainerProps
}

export type NodeDefinition = {
  type: string
  label?: string
  defaultData?: Record<string, unknown>
  render: (props: NodeRenderProps) => ReactNode
  renderContainer?: (props: NodeRenderProps, children: ReactNode) => ReactNode
  getStyle?: (props: NodeRenderProps) => CSSProperties
  canRotate?: boolean
  autoMeasure?: boolean
}

export type NodeRegistry = {
  get: (type: string) => NodeDefinition | undefined
  register: (definition: NodeDefinition) => void
}
