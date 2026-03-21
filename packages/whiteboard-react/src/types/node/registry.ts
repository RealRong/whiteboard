import type { Node, NodePatch, NodeSchema, Rect } from '@whiteboard/core/types'
import type { CSSProperties, ReactNode } from 'react'

export type NodeScene = 'content' | 'container'
export type NodeHit = 'box' | 'path'
export type NodeFamily = 'text' | 'shape' | 'container' | 'draw'
export type ControlId = 'fill' | 'stroke' | 'text' | 'group'

export type NodeMeta = {
  name: string
  family: NodeFamily
  icon: string
  controls: readonly ControlId[]
}

export type NodeRenderProps = {
  node: Node
  rect: Rect
  selected: boolean
  hovered: boolean
  update: (patch: NodePatch) => void
  updateData: (patch: Record<string, unknown>) => void
}

export type NodeDefinition = {
  type: string
  meta: NodeMeta
  scene?: NodeScene
  hit?: NodeHit
  schema?: NodeSchema
  defaultData?: Record<string, unknown>
  render: (props: NodeRenderProps) => ReactNode
  style?: (props: NodeRenderProps) => CSSProperties
  canRotate?: boolean
  canResize?: boolean
  autoMeasure?: boolean
}

export type NodeRegistry = {
  get: (type: string) => NodeDefinition | undefined
  register: (definition: NodeDefinition) => void
}
