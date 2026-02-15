import type { Core, Node, Rect } from '@whiteboard/core'
import type { Commands } from '../commands'
import type { NodeLike, RefLike, StyleObject } from '../ui'

export type NodeContainerProps = {
  rect: Rect
  nodeId?: string
  selected: boolean
  style?: StyleObject
  ref?: RefLike<HTMLDivElement | null>
  onPointerDown?: (event: PointerEvent) => void
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerEnter?: (event: PointerEvent) => void
  onPointerLeave?: (event: PointerEvent) => void
}

export type NodeRenderProps = {
  core: Core
  commands: Commands
  node: Node
  rect: Rect
  selected: boolean
  hovered?: boolean
  zoom: number
  containerProps?: NodeContainerProps
}

export type NodeDefinition = {
  type: string
  label?: string
  defaultData?: Record<string, unknown>
  render: (props: NodeRenderProps) => NodeLike
  renderContainer?: (props: NodeRenderProps, children: NodeLike) => NodeLike
  getStyle?: (props: NodeRenderProps) => StyleObject
  canRotate?: boolean
}

export type NodeRegistry = {
  get: (type: string) => NodeDefinition | undefined
  register: (definition: NodeDefinition) => void
  list: () => NodeDefinition[]
}
