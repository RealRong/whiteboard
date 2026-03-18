import { applyEdgeDefaults, getMissingEdgeFields } from '../schema'
import { err, ok } from '../types'
import type {
  CoreRegistries,
  Document,
  Edge,
  EdgeId,
  EdgeInput,
  EdgePatch,
  Operation,
  Point,
  Result
} from '../types'
import {
  hasEdge,
  hasNode
} from '../types'

export type EdgeCreateOperationResult =
  Result<{
    operation: Extract<Operation, { type: 'edge.create' }>
    edgeId: EdgeId
  }, 'invalid'>

export type InsertRoutingPointResult =
  Result<{
    patch: EdgePatch
    index: number
  }, 'invalid'>

type BuildEdgeCreateOperationInput = {
  payload: EdgeInput
  doc: Document
  registries: CoreRegistries
  createEdgeId: () => EdgeId
}

const isManualRoutingUnsupported = (edge: Edge) =>
  edge.type === 'bezier' || edge.type === 'curve'

const createRoutingPatch = (
  edge: Edge,
  mode: 'auto' | 'manual',
  points?: Point[]
): EdgePatch => ({
  routing: {
    ...(edge.routing ?? {}),
    mode,
    points
  }
})

export const buildEdgeCreateOperation = ({
  payload,
  doc,
  registries,
  createEdgeId
}: BuildEdgeCreateOperationInput): EdgeCreateOperationResult => {
  if (!payload.source?.nodeId || !payload.target?.nodeId) {
    return err('invalid', 'Missing edge endpoints.')
  }
  if (!payload.type) {
    return err('invalid', 'Missing edge type.')
  }
  if (payload.id && hasEdge(doc, payload.id)) {
    return err('invalid', `Edge ${payload.id} already exists.`)
  }
  if (!hasNode(doc, payload.source.nodeId)) {
    return err('invalid', `Source node ${payload.source.nodeId} not found.`)
  }
  if (!hasNode(doc, payload.target.nodeId)) {
    return err('invalid', `Target node ${payload.target.nodeId} not found.`)
  }

  const typeDef = registries.edgeTypes.get(payload.type)
  if (typeDef?.validate && !typeDef.validate(payload.data)) {
    return err('invalid', `Edge ${payload.type} validation failed.`)
  }

  const missing = getMissingEdgeFields(payload, registries)
  if (missing.length > 0) {
    return err('invalid', `Missing required fields: ${missing.join(', ')}.`)
  }

  const normalized = applyEdgeDefaults(payload, registries)
  const id = normalized.id ?? createEdgeId()

  return ok({
    edgeId: id,
    operation: {
      type: 'edge.create',
      edge: {
        ...normalized,
        id,
        type: normalized.type ?? 'linear'
      }
    }
  })
}

export const insertRoutingPoint = (
  edge: Edge,
  pathPoints: Point[],
  segmentIndex: number,
  pointWorld: Point
): InsertRoutingPointResult => {
  if (isManualRoutingUnsupported(edge)) {
    return err('invalid', 'Manual routing is unsupported for this edge type.')
  }
  const basePoints = edge.routing?.points?.length
    ? edge.routing.points
    : pathPoints.slice(1, -1)
  const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
  const nextPoints = [...basePoints]
  nextPoints.splice(insertIndex, 0, pointWorld)
  return ok({
    index: insertIndex,
    patch: createRoutingPatch(edge, 'manual', nextPoints)
  })
}

export const moveRoutingPoint = (
  edge: Edge,
  index: number,
  pointWorld: Point
): EdgePatch | undefined => {
  if (isManualRoutingUnsupported(edge)) return undefined
  const points = edge.routing?.points ?? []
  if (index < 0 || index >= points.length) return undefined
  const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
  return createRoutingPatch(edge, 'manual', nextPoints)
}

export const removeRoutingPoint = (
  edge: Edge,
  index: number
): EdgePatch | undefined => {
  if (isManualRoutingUnsupported(edge)) return undefined
  const points = edge.routing?.points ?? []
  if (index < 0 || index >= points.length) return undefined

  const nextPoints = points.filter((_, idx) => idx !== index)
  if (!nextPoints.length) {
    return createRoutingPatch(edge, 'auto', undefined)
  }
  return createRoutingPatch(edge, 'manual', nextPoints)
}

export const resetRouting = (edge: Edge): EdgePatch =>
  createRoutingPatch(edge, 'auto', undefined)
