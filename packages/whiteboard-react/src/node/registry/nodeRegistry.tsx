import type { CSSProperties, PointerEventHandler, ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { Core, Node, Rect } from '@whiteboard/core'

export type NodeContainerProps = {
  rect: Rect
  nodeId?: string
  selected: boolean
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onPointerEnter?: PointerEventHandler<HTMLDivElement>
  onPointerLeave?: PointerEventHandler<HTMLDivElement>
}

export type NodeRenderProps = {
  core: Core
  node: Node
  rect: Rect
  selected: boolean
  hovered?: boolean
  zoom: number
  containerProps?: NodeContainerProps
}

export type NodeDefinition = {
  type: string
  label?: string
  defaultData?: Record<string, unknown>
  render: (props: NodeRenderProps) => ReactNode
  renderContainer?: (props: NodeRenderProps, children: ReactNode) => ReactNode
  getStyle?: (props: NodeRenderProps) => CSSProperties
  canRotate?: boolean
}

export type NodeRegistry = {
  get: (type: string) => NodeDefinition | undefined
  register: (definition: NodeDefinition) => void
  list: () => NodeDefinition[]
}

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
