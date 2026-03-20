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
  hasNode,
  isNodeEdgeEnd,
  isPointEdgeEnd
} from '../types'

export type EdgeCreateOperationResult =
  Result<{
    operation: Extract<Operation, { type: 'edge.create' }>
    edgeId: EdgeId
  }, 'invalid'>

export type InsertPathPointResult =
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

const createPathPatch = (
  edge: Edge,
  points?: Point[]
): EdgePatch => ({
  path:
    points && points.length > 0
      ? {
          ...(edge.path ?? {}),
          points
        }
      : undefined
})

const validateEdgeEnd = (
  doc: Document,
  end: EdgeInput['source'] | undefined,
  label: 'Source' | 'Target'
) => {
  if (!end) {
    return err('invalid', `Missing ${label.toLowerCase()} edge end.`)
  }

  if (isNodeEdgeEnd(end) && !hasNode(doc, end.nodeId)) {
    return err('invalid', `${label} node ${end.nodeId} not found.`)
  }

  return ok(undefined)
}

export const buildEdgeCreateOperation = ({
  payload,
  doc,
  registries,
  createEdgeId
}: BuildEdgeCreateOperationInput): EdgeCreateOperationResult => {
  if (!payload.source || !payload.target) {
    return err('invalid', 'Missing edge ends.')
  }
  if (!payload.type) {
    return err('invalid', 'Missing edge type.')
  }
  if (payload.id && hasEdge(doc, payload.id)) {
    return err('invalid', `Edge ${payload.id} already exists.`)
  }

  const sourceValidation = validateEdgeEnd(doc, payload.source, 'Source')
  if (!sourceValidation.ok) {
    return sourceValidation
  }
  const targetValidation = validateEdgeEnd(doc, payload.target, 'Target')
  if (!targetValidation.ok) {
    return targetValidation
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

export const insertPathPoint = (
  edge: Edge,
  insertIndex: number,
  pointWorld: Point
): InsertPathPointResult => {
  const basePoints = edge.path?.points ?? []
  const nextInsertIndex = Math.max(0, Math.min(insertIndex, basePoints.length))
  const nextPoints = [...basePoints]
  nextPoints.splice(nextInsertIndex, 0, pointWorld)
  return ok({
    index: nextInsertIndex,
    patch: createPathPatch(edge, nextPoints)
  })
}

export const movePathPoint = (
  edge: Edge,
  index: number,
  pointWorld: Point
): EdgePatch | undefined => {
  const points = edge.path?.points ?? []
  if (index < 0 || index >= points.length) return undefined
  const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
  return createPathPatch(edge, nextPoints)
}

export const removePathPoint = (
  edge: Edge,
  index: number
): EdgePatch | undefined => {
  const points = edge.path?.points ?? []
  if (index < 0 || index >= points.length) return undefined

  const nextPoints = points.filter((_, idx) => idx !== index)
  return createPathPatch(edge, nextPoints)
}

export const clearPath = (edge: Edge): EdgePatch =>
  createPathPatch(edge, undefined)

export const moveEdgePath = (
  edge: Edge,
  delta: Point
): EdgePatch | undefined => {
  if (delta.x === 0 && delta.y === 0) {
    return undefined
  }

  const pathPoints = edge.path?.points?.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y
  }))

  if (!pathPoints?.length) {
    return undefined
  }

  return createPathPatch(edge, pathPoints)
}

export const moveEdge = (
  edge: Edge,
  delta: Point
): EdgePatch | undefined => {
  if (delta.x === 0 && delta.y === 0) {
    return undefined
  }

  let changed = false

  const source = isPointEdgeEnd(edge.source)
    ? {
        ...edge.source,
        point: {
          x: edge.source.point.x + delta.x,
          y: edge.source.point.y + delta.y
        }
      }
    : edge.source
  if (source !== edge.source) {
    changed = true
  }

  const target = isPointEdgeEnd(edge.target)
    ? {
        ...edge.target,
        point: {
          x: edge.target.point.x + delta.x,
          y: edge.target.point.y + delta.y
        }
      }
    : edge.target
  if (target !== edge.target) {
    changed = true
  }

  const pathPatch = moveEdgePath(edge, delta)
  if (pathPatch) {
    changed = true
  }

  if (!changed) {
    return undefined
  }

  return {
    ...(source !== edge.source ? { source } : {}),
    ...(target !== edge.target ? { target } : {}),
    ...(pathPatch ?? {})
  }
}
