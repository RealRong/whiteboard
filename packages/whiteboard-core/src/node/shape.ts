import type { Node } from '../types'

export type ShapeKind =
  | 'rect'
  | 'rounded-rect'
  | 'pill'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'document'
  | 'predefined-process'
  | 'callout'
  | 'cloud'
  | 'arrow-sticker'
  | 'highlight'

const SHAPE_KIND_SET = new Set<ShapeKind>([
  'rect',
  'rounded-rect',
  'pill',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'parallelogram',
  'cylinder',
  'document',
  'predefined-process',
  'callout',
  'cloud',
  'arrow-sticker',
  'highlight'
])

const DEFAULT_SHAPE_KIND: ShapeKind = 'rect'

export const isShapeKind = (
  value: string
): value is ShapeKind => SHAPE_KIND_SET.has(value as ShapeKind)

export const readShapeKind = (
  node: Pick<Node, 'data'>
): ShapeKind => {
  const value = typeof node.data?.kind === 'string'
    ? node.data.kind
    : undefined

  return value && isShapeKind(value)
    ? value
    : DEFAULT_SHAPE_KIND
}
