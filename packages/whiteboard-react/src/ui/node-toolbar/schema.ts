import type { Node, NodeSchema } from '@whiteboard/core/types'

export const hasSchemaField = (
  schema: NodeSchema | undefined,
  scope: 'data' | 'style',
  path: string
) => schema?.fields.some((field) => field.scope === scope && field.path === path) ?? false

export const readTextFieldKey = (
  node: Node,
  schema?: NodeSchema
): 'title' | 'text' => {
  const schemaField = schema?.fields.find((field) =>
    field.scope === 'data' && (field.path === 'text' || field.path === 'title')
  )

  if (schemaField?.path === 'text' || schemaField?.path === 'title') {
    return schemaField.path
  }

  if (typeof node.data?.text === 'string') return 'text'
  return 'title'
}

export const readTextValue = (
  node: Node,
  schema?: NodeSchema
) => {
  const key = readTextFieldKey(node, schema)
  const value = node.data?.[key]
  return typeof value === 'string' ? value : ''
}
