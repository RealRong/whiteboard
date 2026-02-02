import type {
  CoreRegistries,
  Edge,
  EdgeInput,
  EdgeSchema,
  EdgeTypeDefinition,
  Node,
  NodeInput,
  NodeSchema,
  NodeTypeDefinition,
  SchemaField
} from '../types/core'
import { getValueByPath, hasValueByPath, setValueByPath } from '../utils/objectPath'

const mergeDefaults = (target: Record<string, unknown>, defaults: Record<string, unknown>) => {
  Object.entries(defaults).forEach(([key, value]) => {
    const current = target[key]
    if (current === undefined) {
      target[key] = value
      return
    }
    if (current && value && typeof current === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      mergeDefaults(current as Record<string, unknown>, value as Record<string, unknown>)
    }
  })
}

const resolveNodeSchema = (registries: CoreRegistries, type: string): NodeSchema | undefined => {
  return registries.schemas.getNode(type) ?? registries.nodeTypes.get(type)?.schema
}

const resolveEdgeSchema = (registries: CoreRegistries, type: string): EdgeSchema | undefined => {
  return registries.schemas.getEdge(type) ?? registries.edgeTypes.get(type)?.schema
}

const applyFieldDefaults = (target: any, fields: SchemaField[]) => {
  fields.forEach((field) => {
    if (field.defaultValue === undefined) return
    const scope = field.scope ?? 'data'
    if (scope === 'label' && !('label' in target)) return
    if (scope === 'data') {
      target.data = target.data ?? {}
      if (!hasValueByPath(target.data, field.path)) {
        setValueByPath(target.data, field.path, field.defaultValue)
      }
      return
    }
    if (scope === 'style') {
      target.style = target.style ?? {}
      if (!hasValueByPath(target.style, field.path)) {
        setValueByPath(target.style, field.path, field.defaultValue)
      }
      return
    }
    if (scope === 'label') {
      target.label = target.label ?? {}
      if (!hasValueByPath(target.label, field.path)) {
        setValueByPath(target.label, field.path, field.defaultValue)
      }
    }
  })
}

export const applyNodeDefaults = (input: NodeInput, registries: CoreRegistries): NodeInput => {
  const type = input.type
  if (!type) return input
  const next: Node = { ...input }
  const definition = registries.nodeTypes.get(type) as NodeTypeDefinition | undefined
  if (definition?.defaultData) {
    next.data = next.data ?? {}
    mergeDefaults(next.data as Record<string, unknown>, definition.defaultData)
  }
  const schema = resolveNodeSchema(registries, type)
  if (schema?.fields) {
    applyFieldDefaults(next, schema.fields)
  }
  return next
}

export const applyEdgeDefaults = (input: EdgeInput, registries: CoreRegistries): EdgeInput => {
  const type = input.type ?? 'linear'
  const next: Edge = { ...input, type }
  const definition = registries.edgeTypes.get(type) as EdgeTypeDefinition | undefined
  if (definition?.defaultData) {
    next.data = next.data ?? {}
    mergeDefaults(next.data as Record<string, unknown>, definition.defaultData)
  }
  const schema = resolveEdgeSchema(registries, type)
  if (schema?.fields) {
    applyFieldDefaults(next, schema.fields)
  }
  return next
}

const isMissingRequired = (container: unknown, field: SchemaField) => {
  if (!field.required) return false
  if (field.defaultValue !== undefined) return false
  if (!container) return true
  return !hasValueByPath(container, field.path)
}

export const getMissingNodeFields = (input: NodeInput, registries: CoreRegistries): string[] => {
  const type = input.type
  if (!type) return ['type']
  const schema = resolveNodeSchema(registries, type)
  if (!schema?.fields?.length) return []
  const missing: string[] = []
  schema.fields.forEach((field) => {
    const scope = field.scope ?? 'data'
    if (scope === 'style') {
      if (isMissingRequired(input.style, field)) missing.push(field.id)
      return
    }
    if (scope === 'label') {
      if (isMissingRequired((input as any).label, field)) missing.push(field.id)
      return
    }
    if (isMissingRequired(input.data, field)) missing.push(field.id)
  })
  return missing
}

export const getMissingEdgeFields = (input: EdgeInput, registries: CoreRegistries): string[] => {
  const type = input.type ?? 'linear'
  const schema = resolveEdgeSchema(registries, type)
  if (!schema?.fields?.length) return []
  const missing: string[] = []
  schema.fields.forEach((field) => {
    const scope = field.scope ?? 'data'
    if (scope === 'style') {
      if (isMissingRequired(input.style, field)) missing.push(field.id)
      return
    }
    if (scope === 'label') {
      if (isMissingRequired(input.label, field)) missing.push(field.id)
      return
    }
    if (isMissingRequired(input.data, field)) missing.push(field.id)
  })
  return missing
}

export const getSchemaFieldValue = (target: any, field: SchemaField): unknown => {
  const scope = field.scope ?? 'data'
  if (scope === 'style') return getValueByPath(target.style, field.path)
  if (scope === 'label') return getValueByPath(target.label, field.path)
  return getValueByPath(target.data, field.path)
}
