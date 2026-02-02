import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { SchemaField, SchemaFieldType } from '@whiteboard/core'

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

export const createFieldRendererRegistry = (entries: Array<[SchemaFieldType, FieldRenderer]> = []): FieldRendererRegistry => {
  const map = new Map<SchemaFieldType, FieldRenderer>()
  entries.forEach(([type, renderer]) => map.set(type, renderer))
  return {
    get: (type) => map.get(type),
    register: (type, renderer) => {
      map.set(type, renderer)
    },
    list: () => Array.from(map.keys())
  }
}

const FieldRendererRegistryContext = createContext<FieldRendererRegistry | null>(null)

export const FieldRendererRegistryProvider = ({
  registry,
  children
}: {
  registry: FieldRendererRegistry
  children: ReactNode
}) => {
  return <FieldRendererRegistryContext.Provider value={registry}>{children}</FieldRendererRegistryContext.Provider>
}

export const useFieldRendererRegistry = () => {
  const registry = useContext(FieldRendererRegistryContext)
  if (!registry) {
    throw new Error('FieldRendererRegistryProvider is missing.')
  }
  return registry
}
