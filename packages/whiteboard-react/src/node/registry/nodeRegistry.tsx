import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { NodeDefinition, NodeRegistry } from 'types/node'

export const createNodeRegistry = (definitions: NodeDefinition[] = []): NodeRegistry => {
  const map = new Map<string, NodeDefinition>()
  definitions.forEach((definition) => {
    map.set(definition.type, definition)
  })
  return {
    get: (type) => map.get(type),
    register: (definition) => {
      map.set(definition.type, definition)
    },
    list: () => Array.from(map.values())
  }
}

const NodeRegistryContext = createContext<NodeRegistry | null>(null)

export const NodeRegistryProvider = ({
  registry,
  children
}: {
  registry: NodeRegistry
  children: ReactNode
}) => {
  return <NodeRegistryContext.Provider value={registry}>{children}</NodeRegistryContext.Provider>
}

export const useNodeRegistry = () => {
  const registry = useContext(NodeRegistryContext)
  if (!registry) {
    throw new Error('NodeRegistryProvider is missing.')
  }
  return registry
}
