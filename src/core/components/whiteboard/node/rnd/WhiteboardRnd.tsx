import { forwardRef, RefObject, useEffect, useRef } from 'react'
import * as React from 'react'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { Resizer, Direction } from './Resizer'
import { useMemoizedFn, useMergedRef, useRafFn } from '@/hooks'

type Size = {
  width: number | string
  height: number | string
}
const getPixelSize = (size: undefined | string | number) => {
  if (size && typeof size === 'string') {
    return parseFloat(size)
  }
  return size
}

const calculateNewMax = (
  maxWidth?: string | number,
  maxHeight?: string | number,
  minWidth?: string | number,
  minHeight?: string | number
) => {
  maxWidth = getPixelSize(maxWidth)
  maxHeight = getPixelSize(maxHeight)
  minWidth = getPixelSize(minWidth)
  minHeight = getPixelSize(minHeight)
  return {
    maxWidth: typeof maxWidth === 'undefined' ? undefined : Number(maxWidth),
    maxHeight: typeof maxHeight === 'undefined' ? undefined : Number(maxHeight),
    minWidth: typeof minWidth === 'undefined' ? undefined : Number(minWidth),
    minHeight: typeof minHeight === 'undefined' ? undefined : Number(minHeight)
  }
}

const calculateNewSizeFromAspectRatio = (
  newWidth: number,
  newHeight: number,
  max: { width?: number; height?: number },
  min: { width?: number; height?: number },
  ratio?: number
) => {
  const computedMinWidth = typeof min.width === 'undefined' ? 10 : min.width
  const computedMaxWidth = typeof max.width === 'undefined' || max.width < 0 ? newWidth : max.width
  const computedMinHeight = typeof min.height === 'undefined' ? 10 : min.height
  const computedMaxHeight = typeof max.height === 'undefined' || max.height < 0 ? newHeight : max.height
  if (ratio) {
    const extraMinWidth = computedMinHeight * ratio
    const extraMaxWidth = computedMaxHeight * ratio
    const extraMinHeight = computedMinWidth / ratio
    const extraMaxHeight = computedMaxWidth / ratio
    const lockedMinWidth = Math.max(computedMinWidth, extraMinWidth)
    const lockedMaxWidth = Math.min(computedMaxWidth, extraMaxWidth)
    const lockedMinHeight = Math.max(computedMinHeight, extraMinHeight)
    const lockedMaxHeight = Math.min(computedMaxHeight, extraMaxHeight)
    newWidth = clamp(newWidth, lockedMinWidth, lockedMaxWidth)
    newHeight = clamp(newHeight, lockedMinHeight, lockedMaxHeight)
  } else {
    newWidth = clamp(newWidth, computedMinWidth, computedMaxWidth)
    newHeight = clamp(newHeight, computedMinHeight, computedMaxHeight)
  }
  return { newWidth, newHeight }
}
type DragCallback = (
  e: PointerEvent,
  data: {
    node: HTMLElement
    x: number
    y: number
    deltaX: number
    deltaY: number
  }
) => void
type Position = {
  x: number
  y: number
}
type ResizeCallback = (e: PointerEvent, dir: Direction, elementRef: HTMLElement) => void | boolean
type Props = Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, 'onDrag' | 'onDragStart' | 'onResize'> & {
  style?: React.CSSProperties
  className?: string
  size: Partial<Size>
  position: Position
  minWidth?: string | number
  minHeight?: string | number
  maxWidth?: string | number
  maxHeight?: string | number
  lockAspectRatio?: boolean | number
  draggable?: boolean
  resizable?:
    | {
        top?: boolean
        right?: boolean
        bottom?: boolean
        left?: boolean
        topRight?: boolean
        bottomRight?: boolean
        bottomLeft?: boolean
        topLeft?: boolean
      }
    | boolean
  children?: React.ReactNode
  onResizeStart?: ResizeCallback
  onResize?: ResizeCallback
  onResizeStop?: ResizeCallback
  onDragStart?: (e: PointerEvent) => void
  onDragStop?: DragCallback
  onDrag?: DragCallback
  isResizing?: RefObject<boolean>
  isDragging?: RefObject<boolean>
}
const defaultResizable: Props['resizable'] = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true
}
const clamp = (n: number, min: number, max: number): number => Math.max(Math.min(n, max), min)
export default forwardRef<HTMLDivElement, Props>(
  (
    {
      maxHeight,
      maxWidth,
      minHeight,
      minWidth,
      lockAspectRatio,
      size,
      isResizing,
      onResize,
      onResizeStart: propsOnResizeStart,
      onResizeStop,
      children,
      className,
      draggable,
      resizable = defaultResizable,
      isDragging,
      onDrag,
      onDragStart: propsOnDragStart,
      onDragStop,
      position,
      style,
      ...rest
    },
    ref
  ) => {
    const elementRef = useRef<HTMLDivElement>(null)
    const mergedRef = useMergedRef(ref, elementRef)
    const instance = useWhiteboardInstance()
    const stateRef = useRef<{
      direction?: Direction
      original?: {
        x: number
        y: number
        width: number
        height: number
      }
      ratio: number
    }>({
      ratio: 1
    })
    const bindEvents = () => {
      addEventListener('pointerup', onMouseUp)
      addEventListener('pointermove', onMouseMove)
    }
    const unbindEvents = () => {
      removeEventListener('pointerup', onMouseUp)
      removeEventListener('pointermove', onMouseMove)
    }
    const getSize = () => {
      let width = 0
      let height = 0
      const ele = elementRef.current
      if (ele) {
        width = ele.offsetWidth
        height = ele.offsetHeight
      }
      return { width, height }
    }
    const calculateNewSizeFromDirection = (clientX: number, clientY: number) => {
      const scale = 1
      const { direction, original, ratio } = stateRef.current
      if (!original) throw ''
      let newWidth = original.width
      let newHeight = original.height
      if (direction?.toLowerCase().includes('right')) {
        newWidth = original.width + (clientX - original.x) / scale
        if (lockAspectRatio) {
          newHeight = newWidth / ratio
        }
      }
      if (direction?.toLowerCase().includes('left')) {
        newWidth = original.width - (clientX - original.x) / scale
        if (lockAspectRatio) {
          newHeight = newWidth / ratio
        }
      }
      if (direction?.toLowerCase().includes('bottom')) {
        newHeight = original.height + (clientY - original.y) / scale
        if (lockAspectRatio) {
          newWidth = newHeight * ratio
        }
      }
      if (direction?.toLowerCase().includes('top')) {
        newHeight = original.height - (clientY - original.y) / scale
        if (lockAspectRatio) {
          newWidth = newHeight * ratio
        }
      }
      return { newWidth, newHeight }
    }
    const onMouseMove = useMemoizedFn(
      useRafFn((event: PointerEvent) => {
        const ele = elementRef.current
        const { original, ratio, direction } = stateRef.current
        const pointerXY = instance.coordOps?.transformWindowPositionToPosition?.({ x: event.clientX, y: event.clientY })
        if (!pointerXY) return
        console.log(isDragging?.current, isResizing?.current)
        if (isResizing?.current) {
          if (!ele || !original || !direction) {
            return
          }
          const {
            maxHeight: maxH,
            maxWidth: maxW,
            minHeight: minH,
            minWidth: minW
          } = calculateNewMax(maxWidth, maxHeight, minWidth, minHeight)

          // Calculate new size
          let { newHeight, newWidth } = calculateNewSizeFromDirection(pointerXY.x, pointerXY.y)
          // Calculate new size from aspect ratio
          const newSize = calculateNewSizeFromAspectRatio(
            newWidth,
            newHeight,
            { width: maxW, height: maxH },
            { width: minW, height: minH },
            lockAspectRatio ? ratio : undefined
          )
          newWidth = newSize.newWidth
          newHeight = newSize.newHeight
          const size = getSize()
          if (size.width !== newWidth || size.height !== newHeight) {
            const newPos = { x: position.x, y: position.y }
            const directions: Direction[] = ['top', 'left', 'topLeft', 'bottomLeft', 'topRight']
            if (directions.includes(direction)) {
              const dx = -(newWidth - original.width)
              const dy = -(newHeight - original.height)
              if (direction === 'bottomLeft') {
                newPos.x += dx
              } else if (direction === 'topRight') {
                newPos.y += dy
              } else {
                newPos.x += dx
                newPos.y += dy
              }
            }
            const widthChangeDirections: Direction[] = ['left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight']
            const heightChangeDirections: Direction[] = ['top', 'topRight', 'topLeft', 'bottomRight', 'bottomLeft', 'bottom']
            if (widthChangeDirections.includes(direction)) {
              ele.style.width = `${newWidth}px`
            }
            if (heightChangeDirections.includes(direction)) {
              ele.style.height = `${newHeight}px`
            }
            ele.style.transform = `translate(${newPos.x}px, ${newPos.y}px)`
            onResize?.(event, direction, ele)
          }
        }
        if (isDragging?.current) {
          if (!ele || !original) {
            return
          }
          const pointerXY = instance.coordOps?.transformWindowPositionToPosition?.({ x: event.clientX, y: event.clientY })
          if (!pointerXY) return
          const delta = {
            dx: pointerXY.x - original.x,
            dy: pointerXY.y - original.y
          }
          if (Math.abs(delta.dx) > 1 || Math.abs(delta.dy) > 1) {
            const currentPosition: Position = {
              x: position.x + delta.dx,
              y: position.y + delta.dy
            }
            ele.style.transform = `translate(${currentPosition.x}px, ${currentPosition.y}px)`
            onDrag?.(event, {
              node: ele,
              deltaX: delta.dx,
              deltaY: delta.dy,
              x: currentPosition.x,
              y: currentPosition.y
            })
          }
        }
      })
    )
    const onMouseUp = useMemoizedFn((event: PointerEvent) => {
      const ele = elementRef.current
      const { direction, original } = stateRef.current
      unbindEvents()
      const pointerXY = instance.coordOps?.transformWindowPositionToPosition?.({ x: event.clientX, y: event.clientY })
      if (!pointerXY) return
      if (isResizing?.current) {
        document.body.style.removeProperty('cursor')
        if (!ele || !original || !direction) {
          return
        }
        onResizeStop?.(event, direction, ele)
      }
      if (isDragging?.current) {
        if (!ele || !original) {
          return
        }
        const delta = {
          dx: pointerXY.x - original.x,
          dy: pointerXY.y - original.y
        }
        const currentPosition: Position = {
          x: position.x + delta.dx,
          y: position.y + delta.dy
        }
        onDragStop?.(event, {
          node: ele,
          deltaX: delta.dx,
          deltaY: delta.dy,
          x: currentPosition.x,
          y: currentPosition.y
        })
      }
    })
    const onDragStart = (event: PointerEvent) => {
      const ele = elementRef.current
      if (!ele) {
        return
      }
      if (event.button !== 0) return
      const pointerXY = instance.coordOps?.transformWindowPositionToPosition?.({ x: event.clientX, y: event.clientY })
      if (!pointerXY) return
      const currentSize = getSize()
      stateRef.current.original = {
        x: pointerXY.x,
        y: pointerXY.y,
        width: currentSize.width,
        height: currentSize.height
      }
      propsOnDragStart?.(event)
      bindEvents()
    }
    const onResizeStart = (event: PointerEvent, direction: Direction, cursor?: string) => {
      const ele = elementRef.current
      if (!ele) {
        return
      }
      if (event.button !== 0) return
      const pointerXY = instance.coordOps?.transformWindowPositionToPosition?.({ x: event.clientX, y: event.clientY })
      if (!pointerXY) return
      propsOnResizeStart?.(event, direction, ele)
      bindEvents()
      if (cursor) {
        document.body.style.cursor = cursor
      }
      const currentSize = getSize()
      if (lockAspectRatio) {
        if (typeof lockAspectRatio === 'number') {
          stateRef.current.ratio = lockAspectRatio
        } else {
          stateRef.current.ratio = currentSize.width / currentSize.height
        }
      }

      stateRef.current.original = {
        x: pointerXY.x,
        y: pointerXY.y,
        width: currentSize.width,
        height: currentSize.height
      }
      stateRef.current.direction = direction
    }

    const renderResizer = () => {
      if (!resizable) {
        return null
      }
      const resizers = Object.keys(resizable === true ? defaultResizable : resizable).map(dir => {
        if (resizable === true || resizable[dir as Direction] !== false) {
          return <Resizer key={dir} direction={dir as Direction} onResizeStart={onResizeStart}></Resizer>
        }
        return null
      })
      return <div className={'resizers'}>{resizers}</div>
    }
    return (
      <div
        {...rest}
        onPointerDownCapture={e => {
          rest.onPointerDownCapture?.(e)
          if (draggable) {
            if (e.target instanceof HTMLElement && e.target.closest('input,textarea,[contenteditable],.resizers')) return
            e.preventDefault()
            onDragStart(e.nativeEvent)
          }
        }}
        className={className}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: size.width,
          height: size.height,
          position: 'absolute',
          cursor: draggable ? 'grab' : style?.cursor,
          maxWidth,
          minWidth,
          maxHeight,
          minHeight,
          ...style
        }}
        ref={mergedRef}
      >
        {children}
        {renderResizer()}
      </div>
    )
  }
)
