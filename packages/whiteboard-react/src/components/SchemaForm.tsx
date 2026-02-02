import type { ReactNode } from 'react'
import type { Edge, Node, SchemaField, SchemaFieldVisibility } from '@whiteboard/core'
import { getValueByPath } from '@whiteboard/core'
import type { FieldRendererRegistry } from '../registry/fieldRegistry'

export type SchemaFormProps = {
  schemaLabel?: string
  fields: SchemaField[]
  target: Node | Edge
  fieldRegistry: FieldRendererRegistry
  onFieldChange: (field: SchemaField, value: unknown) => void
  disabled?: boolean
  emptyState?: ReactNode
}

const getScopeValue = (target: Node | Edge, field: SchemaField) => {
  const scope = field.scope ?? 'data'
  if (scope === 'style') return target.style
  if (scope === 'label') return (target as Edge).label
  return target.data
}

const isVisible = (target: Node | Edge, field: SchemaField): boolean => {
  if (!field.visibleIf) return true
  const condition: SchemaFieldVisibility = field.visibleIf
  const scope = condition.scope ?? field.scope ?? 'data'
  const container =
    scope === 'style' ? target.style : scope === 'label' ? (target as Edge).label : target.data
  const value = getValueByPath(container, condition.path)
  if (condition.exists !== undefined) {
    return condition.exists ? value !== undefined : value === undefined
  }
  if (condition.equals !== undefined) {
    return value === condition.equals
  }
  if (condition.notEquals !== undefined) {
    return value !== condition.notEquals
  }
  return Boolean(value)
}

export const SchemaForm = ({
  schemaLabel,
  fields,
  target,
  fieldRegistry,
  onFieldChange,
  disabled,
  emptyState
}: SchemaFormProps) => {
  if (!fields.length) {
    return <div style={{ fontSize: 12, color: '#6b7280' }}>{emptyState ?? 'No schema fields.'}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {schemaLabel ? (
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {schemaLabel}
        </div>
      ) : null}
      {fields.map((field) => {
        if (!isVisible(target, field)) return null
        const renderer = fieldRegistry.get(field.type)
        if (!renderer) return null
        const value = getValueByPath(getScopeValue(target, field), field.path)
        const showLabel = field.type !== 'boolean'
        return (
          <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {showLabel ? (
              <div style={{ fontSize: 12, color: '#111827' }}>
                {field.label}
                {field.required ? <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span> : null}
              </div>
            ) : null}
            {renderer({
              field,
              value,
              onChange: (next) => onFieldChange(field, next),
              disabled
            })}
            {field.description ? (
              <div style={{ fontSize: 11, color: '#6b7280' }}>{field.description}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
