import type { Node, NodePatch, NodeSchema, Rect } from '@whiteboard/core/types'
import type { CSSProperties, ReactNode } from 'react'

export type NodeRenderProps = {
  node: Node
  rect: Rect
  selected: boolean
  hovered: boolean
  update: (patch: NodePatch) => Promise<void>
  updateData: (patch: Record<string, unknown>) => Promise<void>
}

export type NodeDefinition = {
  type: string
  label?: string
  schema?: NodeSchema
  defaultData?: Record<string, unknown>
  render: (props: NodeRenderProps) => ReactNode
  style?: (props: NodeRenderProps) => CSSProperties
  canRotate?: boolean
  autoMeasure?: boolean
}

export type NodeRegistry = {
  get: (type: string) => NodeDefinition | undefined
  register: (definition: NodeDefinition) => void
}
