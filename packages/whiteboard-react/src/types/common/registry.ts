import type { SchemaField, SchemaFieldType } from '@whiteboard/core'
import type { ReactNode } from 'react'

export type FieldRendererProps = {
  field: SchemaField
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

export type FieldRenderer = (props: FieldRendererProps) => ReactNode

export type FieldRendererRegistry = {
  get: (type: SchemaFieldType) => FieldRenderer | undefined
  register: (type: SchemaFieldType, renderer: FieldRenderer) => void
  list: () => SchemaFieldType[]
}
