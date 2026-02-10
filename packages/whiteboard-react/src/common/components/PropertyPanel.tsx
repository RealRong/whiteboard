import type { PropertyPanelProps } from 'types/common'
import { useMemo } from 'react'
import type { Core, Document, Edge, EdgeId, Node, NodeId, SchemaField } from '@whiteboard/core'
import { setValueByPath } from '@whiteboard/core'
import { SchemaForm } from './SchemaForm'
import { createDefaultFieldRendererRegistry } from '../registry/defaultFieldRenderers'

const resolveNode = (doc: Document, nodeId?: NodeId): Node | undefined => {
  if (!nodeId) return undefined
  return doc.nodes.find((node) => node.id === nodeId)
}

const resolveEdge = (doc: Document, edgeId?: EdgeId): Edge | undefined => {
  if (!edgeId) return undefined
  return doc.edges.find((edge) => edge.id === edgeId)
}

const ensureScopeContainer = (target: any, field: SchemaField) => {
  const scope = field.scope ?? 'data'
  if (scope === 'style') {
    target.style = target.style ?? {}
    return target.style
  }
  if (scope === 'label') {
    target.label = target.label ?? {}
    return target.label
  }
  target.data = target.data ?? {}
  return target.data
}

export const PropertyPanel = ({
  core,
  doc,
  onDocChange,
  selectedNodeId,
  selectedEdgeId,
  fieldRegistry,
  className,
  style,
  emptyState
}: PropertyPanelProps) => {
  const registry = useMemo(() => fieldRegistry ?? createDefaultFieldRendererRegistry(), [fieldRegistry])
  const node = resolveNode(doc, selectedNodeId)
  const edge = resolveEdge(doc, selectedEdgeId)
  const target = edge ?? node

  const schema = useMemo(() => {
    if (edge) {
      return core.registries.schemas.getEdge(edge.type) ?? core.registries.edgeTypes.get(edge.type)?.schema
    }
    if (node) {
      return core.registries.schemas.getNode(node.type) ?? core.registries.nodeTypes.get(node.type)?.schema
    }
    return undefined
  }, [core, edge, node])

  const handleFieldChange = (field: SchemaField, value: unknown) => {
    if (!target) return
    onDocChange((draft) => {
      if (edge) {
        const current = draft.edges.find((item) => item.id === edge.id)
        if (!current) return
        const container = ensureScopeContainer(current, field)
        setValueByPath(container, field.path, value)
        return
      }
      if (node) {
        const current = draft.nodes.find((item) => item.id === node.id)
        if (!current) return
        const container = ensureScopeContainer(current, field)
        setValueByPath(container, field.path, value)
      }
    })
  }

  if (!target) {
    return (
      <div
        className={className ? `wb-property-panel-empty ${className}` : 'wb-property-panel-empty'}
        style={style}
      >
        {emptyState ?? 'No selection.'}
      </div>
    )
  }
  if (!schema) {
    return (
      <div
        className={className ? `wb-property-panel-empty ${className}` : 'wb-property-panel-empty'}
        style={style}
      >
        No schema for selected item.
      </div>
    )
  }

  return (
    <div className={className} style={style}>
      <div className="wb-property-panel-title">
        {edge ? 'Edge' : 'Node'} · {schema.label ?? schema.type}
      </div>
      <SchemaForm
        schemaLabel={undefined}
        fields={schema.fields}
        target={target}
        fieldRegistry={registry}
        onFieldChange={handleFieldChange}
      />
    </div>
  )
}
