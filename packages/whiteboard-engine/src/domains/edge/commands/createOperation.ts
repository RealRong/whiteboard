import { applyEdgeDefaults, getMissingEdgeFields } from '@whiteboard/core/schema'
import type { CoreRegistries, Document, EdgeId, EdgeInput, Operation } from '@whiteboard/core/types'

export type EdgeCreateOperationResult =
  | {
      ok: true
      operation: Extract<Operation, { type: 'edge.create' }>
    }
  | {
      ok: false
      message: string
    }

type BuildEdgeCreateOperationInput = {
  payload: EdgeInput
  doc: Document
  registries: CoreRegistries
  createEdgeId: () => EdgeId
}

export const buildEdgeCreateOperation = ({
  payload,
  doc,
  registries,
  createEdgeId
}: BuildEdgeCreateOperationInput): EdgeCreateOperationResult => {
  if (!payload.source?.nodeId || !payload.target?.nodeId) {
    return {
      ok: false,
      message: 'Missing edge endpoints.'
    }
  }
  if (!payload.type) {
    return {
      ok: false,
      message: 'Missing edge type.'
    }
  }
  if (payload.id && doc.edges.some((edge) => edge.id === payload.id)) {
    return {
      ok: false,
      message: `Edge ${payload.id} already exists.`
    }
  }
  if (!doc.nodes.some((node) => node.id === payload.source.nodeId)) {
    return {
      ok: false,
      message: `Source node ${payload.source.nodeId} not found.`
    }
  }
  if (!doc.nodes.some((node) => node.id === payload.target.nodeId)) {
    return {
      ok: false,
      message: `Target node ${payload.target.nodeId} not found.`
    }
  }

  const typeDef = registries.edgeTypes.get(payload.type)
  if (typeDef?.validate && !typeDef.validate(payload.data)) {
    return {
      ok: false,
      message: `Edge ${payload.type} validation failed.`
    }
  }

  const missing = getMissingEdgeFields(payload, registries)
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing required fields: ${missing.join(', ')}.`
    }
  }

  const normalized = applyEdgeDefaults(payload, registries)
  const id = normalized.id ?? createEdgeId()

  return {
    ok: true,
    operation: {
      type: 'edge.create',
      edge: {
        ...normalized,
        id,
        type: normalized.type ?? 'linear'
      }
    }
  }
}
