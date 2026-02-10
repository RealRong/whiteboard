import type { ChangeEvent } from 'react'
import type { SchemaField, SchemaFieldOption } from '@whiteboard/core'
import { createFieldRendererRegistry } from './fieldRegistry'
import type { FieldRendererRegistry } from 'types/common'

const parseNumber = (value: string, fallback?: number) => {
  if (value.trim() === '') return fallback
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

const getEnumOptions = (field: SchemaField): SchemaFieldOption[] => {
  if (!field.options) return []
  return field.options
}

export const createDefaultFieldRendererRegistry = (): FieldRendererRegistry => {
  return createFieldRendererRegistry([
    [
      'string',
      ({ value, onChange, field, disabled }) => (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          disabled={disabled || field.readonly}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          className="wb-field-input"
        />
      )
    ],
    [
      'text',
      ({ value, onChange, field, disabled }) => (
        <textarea
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          disabled={disabled || field.readonly}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
          className="wb-field-textarea"
        />
      )
    ],
    [
      'number',
      ({ value, onChange, field, disabled }) => (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          disabled={disabled || field.readonly}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(parseNumber(event.target.value))}
          className="wb-field-input"
        />
      )
    ],
    [
      'boolean',
      ({ value, onChange, field, disabled }) => (
        <label className="wb-field-checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled || field.readonly}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      )
    ],
    [
      'color',
      ({ value, onChange, field, disabled }) => (
        <div className="wb-field-color-row">
          <input
            type="color"
            value={typeof value === 'string' ? value : '#000000'}
            disabled={disabled || field.readonly}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          />
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            disabled={disabled || field.readonly}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            className="wb-field-input wb-field-color-text"
          />
        </div>
      )
    ],
    [
      'enum',
      ({ value, onChange, field, disabled }) => {
        const options = getEnumOptions(field)
        const allowEmpty = !field.required
        const emptyLabel = field.placeholder ?? 'None'
        return (
          <select
            value={value === undefined ? '' : String(value)}
            disabled={disabled || field.readonly}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const raw = event.target.value
              const matched = options.find((option) => String(option.value) === raw)
              onChange(matched ? matched.value : raw)
            }}
            className="wb-field-select"
          >
            {allowEmpty ? (
              <option value="">{emptyLabel}</option>
            ) : (
              <option value="" disabled>
                {emptyLabel}
              </option>
            )}
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        )
      }
    ]
  ])
}
