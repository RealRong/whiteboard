import type { Point, Rect } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common'
import type { ResizeDirection, TransformHandle } from '@engine-types/node'
import {
  buildTransformHandles as buildTransformHandlesCore,
  computeNextRotation as computeNextRotationCore,
  computeResizeRect as computeResizeRectCore,
  getResizeSourceEdges as getResizeSourceEdgesCore,
  resizeHandleMap as resizeHandleMapCore,
  rotateVector as rotateVectorCore
} from '@whiteboard/core/node'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../../config'

type ResizeHandleMeta = {
  sx: -1 | 0 | 1
  sy: -1 | 0 | 1
  cursor: string
}

export type HorizontalResizeEdge = 'left' | 'right'
export type VerticalResizeEdge = 'top' | 'bottom'

export const resizeHandleMap: Record<ResizeDirection, ResizeHandleMeta> =
  resizeHandleMapCore as Record<ResizeDirection, ResizeHandleMeta>

export const getResizeSourceEdges = (
  handle: ResizeDirection
): { sourceX?: HorizontalResizeEdge; sourceY?: VerticalResizeEdge } =>
  getResizeSourceEdgesCore(handle) as {
    sourceX?: HorizontalResizeEdge
    sourceY?: VerticalResizeEdge
  }

export const rotateVector = (vector: Point, rotation: number) =>
  rotateVectorCore(vector, rotation)

export const buildTransformHandles = (options: {
  rect: Rect
  rotation: number
  canRotate: boolean
  rotateHandleOffset: number
  zoom: number
}): TransformHandle[] =>
  buildTransformHandlesCore({
    ...options,
    zoomEpsilon: DEFAULT_INTERNALS.zoomEpsilon
  }) as TransformHandle[]

export const computeResizeRect = (options: {
  handle: ResizeDirection
  startScreen: Point
  currentScreen: Point
  startCenter: Point
  startRotation: number
  startSize: Size
  startAspect: number
  minSize: Size
  zoom: number
  altKey: boolean
  shiftKey: boolean
}) =>
  computeResizeRectCore({
    ...options,
    zoomEpsilon: DEFAULT_INTERNALS.zoomEpsilon
  })

export const computeNextRotation = (options: {
  center: Point
  currentPoint: Point
  startAngle: number
  startRotation: number
  shiftKey: boolean
}) =>
  computeNextRotationCore({
    ...options,
    rotateSnapStep: DEFAULT_TUNING.nodeTransform.rotateSnapStep
  })
