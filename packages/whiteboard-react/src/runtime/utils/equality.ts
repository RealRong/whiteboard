import type { Rect } from '@whiteboard/core/types'

type Equal<T> = (left: T, right: T) => boolean

const isStrictEqual = <T>(
  left: T,
  right: T
) => left === right

export const isOrderedArrayEqual = <T>(
  left: readonly T[],
  right: readonly T[],
  isEqual: Equal<T> = isStrictEqual
) => (
  left === right
  || (
    left.length === right.length
    && left.every((item, index) => isEqual(item, right[index]!))
  )
)

const isOptionalEqual = <T>(
  left: T | undefined,
  right: T | undefined,
  isEqual: Equal<T>
) => (
  left === right
  || (
    left !== undefined
    && right !== undefined
    && isEqual(left, right)
  )
)

export const isRectEqual = (
  left: Rect | undefined,
  right: Rect | undefined
) => (
  left === right
  || (
    left?.x === right?.x
    && left?.y === right?.y
    && left?.width === right?.width
    && left?.height === right?.height
  )
)
