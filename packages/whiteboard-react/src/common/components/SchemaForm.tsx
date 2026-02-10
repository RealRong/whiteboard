import type { SchemaFormProps } from 'types/common'
import type { Edge, Node, SchemaField, SchemaFieldVisibility } from '@whiteboard/core'
import { getValueByPath } from '@whiteboard/core'

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
    return <div className="wb-schema-empty">{emptyState ?? 'No schema fields.'}</div>
  }

  return (
    <div className="wb-schema-form">
      {schemaLabel ? (
        <div className="wb-schema-title">
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
          <div key={field.id} className="wb-schema-field">
            {showLabel ? (
              <div className="wb-schema-label">
                {field.label}
                {field.required ? <span className="wb-schema-required">*</span> : null}
              </div>
            ) : null}
            {renderer({
              field,
              value,
              onChange: (next) => onFieldChange(field, next),
              disabled
            })}
            {field.description ? (
              <div className="wb-schema-description">{field.description}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
