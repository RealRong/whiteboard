import type { CSSProperties, ReactNode } from 'react'
import type { Core, Document, Edge, EdgeId, Node, NodeId, SchemaField } from '@whiteboard/core'
import type { FieldRendererRegistry } from './registry'

export type SchemaFormProps = {
  schemaLabel?: string
  fields: SchemaField[]
  target: Node | Edge
  fieldRegistry: FieldRendererRegistry
  onFieldChange: (field: SchemaField, value: unknown) => void
  disabled?: boolean
  emptyState?: ReactNode
}

export type PropertyPanelProps = {
  core: Core
  doc: Document
  onDocChange: (recipe: (draft: Document) => void) => void
  selectedNodeId?: NodeId
  selectedEdgeId?: EdgeId
  fieldRegistry?: FieldRendererRegistry
  className?: string
  style?: CSSProperties
  emptyState?: ReactNode
}
