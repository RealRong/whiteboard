import { useRafFn, useSelectGlobalAtomValue } from '@/hooks'
import { css } from '@emotion/css'
import { FC, memo, PointerEventHandler, useEffect, useMemo, useRef } from 'react'
import { useUpdate } from 'react-use'
import { IWhiteboardNode, Box } from '~/typings'
import { useWhiteboardNodes } from './StateHooks'
import { getBoxOfBoxes, getBoxOfNodes } from './utils'
import tinycolor from 'tinycolor2'
import { WithBorder } from '@/components'
import { Colors } from '@/consts'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { SettingAtom } from '@/core'

interface MinimapProps {
  width?: number
  height?: number
}
const DEFAULT_MINIMAP_WIDTH = 250
const DEFAULT_MINIMAP_HEIGHT = 150
const WhiteboardMiniMap: FC<MinimapProps> = memo(({ width = DEFAULT_MINIMAP_WIDTH, height = DEFAULT_MINIMAP_HEIGHT }) => {
  const nodes = useWhiteboardNodes()
  const instance = useWhiteboardInstance()
  const transform = instance.getTransform?.()
  const containerBounding = instance.getContainerNode()?.getBoundingClientRect()
  const isDarkMode = useSelectGlobalAtomValue(SettingAtom, s => s.general.darkMode)
  const viewBox: Box | null =
    transform && containerBounding
      ? {
          left: -transform?.x / transform?.scale,
          top: -transform.y / transform.scale,
          width: containerBounding.width / transform.scale,
          height: containerBounding.height / transform.scale
        }
      : null
  const prevBoundingRect = useRef<Box>()
  const boundingRect = useMemo(() => {
    if (viewBox) {
      const nodesRect = getBoxOfNodes(Array.from(nodes.values()))
      if (nodesRect !== undefined) {
        const box = getBoxOfBoxes([nodesRect, viewBox]) as Box
        prevBoundingRect.current = box
        return box
      } else {
        return (
          prevBoundingRect.current || {
            width: 0,
            height: 0,
            left: 0,
            top: 0
          }
        )
      }
    }
    return {
      width: 0,
      height: 0,
      left: 0,
      top: 0
    }
  }, [nodes, viewBox])
  const forceUpdate = useUpdate()
  const rafUpdate = useRafFn(forceUpdate)
  const transformScale = transform?.scale ?? 1
  const scaledWidth = boundingRect.width / width
  const scaledHeight = boundingRect.height / height
  const viewScale = Math.max(scaledHeight, scaledWidth)
  const viewWidth = width * viewScale
  const viewHeight = height * viewScale
  const offset = 5 * viewScale
  const x = boundingRect.left - (viewWidth - boundingRect.width) / 2 - offset
  const y = boundingRect.top - (viewHeight - boundingRect.height) / 2 - offset
  const realWidth = viewWidth + offset * 2
  const realHeight = viewHeight + offset * 2
  const isPressedRef = useRef(false)
  useEffect(() => {
    instance.addEventListener('panChange', rafUpdate)
    instance.addEventListener('zoomChange', rafUpdate)
    return () => {
      instance.removeEventListener('panChange', rafUpdate)
      instance.removeEventListener('zoomChange', rafUpdate)
    }
  }, [])
  const svgPointerDownHandler: PointerEventHandler = e => {
    if (viewBox) {
      isPressedRef.current = true
      const currentBounding = e.currentTarget.getBoundingClientRect()
      const { clientX, clientY } = e
      const relX = clientX - currentBounding.left
      const relY = clientY - currentBounding.top
      const newViewboxLeft = (realWidth + offset * 2) * (relX / width) + x - offset
      const newX = (newViewboxLeft - viewBox?.width / transformScale / 2) * transformScale
      const newViewboxTop = (realHeight + offset * 2) * (relY / height) + y - offset
      const newY = (newViewboxTop - viewBox?.height / transformScale / 2) * transformScale
      instance.panzoom?.moveTo(-newX, -newY)
    }
  }

  const svgPointerMoveHandler: PointerEventHandler = e => {
    if (isPressedRef.current && viewBox) {
      const currentBounding = e.currentTarget.getBoundingClientRect()
      const { clientX, clientY } = e
      const relX = clientX - currentBounding.left
      const relY = clientY - currentBounding.top
      const newViewboxLeft = (realWidth + offset * 2) * (relX / width) + x - offset
      const newX = (newViewboxLeft - viewBox.width / transformScale / 2) * transformScale
      const newViewboxTop = (realHeight + offset * 2) * (relY / height) + y - offset
      const newY = (newViewboxTop - viewBox.height / transformScale / 2) * transformScale
      instance.panzoom?.moveTo(-newX, -newY)
    }
  }
  return (
    <WithBorder
      style={{
        background: Colors.Background.Secondary,
        height: 150,
        overflow: 'hidden'
      }}
    >
      <svg
        onPointerDown={svgPointerDownHandler}
        onPointerMove={svgPointerMoveHandler}
        style={{
          '--view-scale': viewScale
        }}
        onPointerUp={() => {
          isPressedRef.current = false
        }}
        width={width}
        height={height}
        viewBox={`${x} ${y} ${realWidth} ${realHeight}`}
      >
        {Array.from(nodes.values()).map(i => (
          <MinimapNode {...i} isDark={isDarkMode} key={i.id} />
        ))}
        {viewBox && (
          <path
            d={`M${x - offset},${y - offset}h${realWidth + offset * 2}v${realHeight + offset * 2}h${-realWidth - offset * 2}z
        M${viewBox.left},${viewBox.top}h${viewBox.width / transformScale}v${viewBox.height / transformScale}h${
          -viewBox.width / transformScale
        }z`}
            fill={'rgba(0,0,0,0.2)'}
            fillRule="evenodd"
            pointerEvents="none"
          />
        )}
      </svg>
    </WithBorder>
  )
})

const MinimapNode: FC<IWhiteboardNode & { isDark: boolean }> = ({ x, y, width, height, name, background, id, type, isDark }) => {
  const defaultColor = isDark ? 'white' : 'black'
  const lightenbG = useMemo(() => {
    if (type === 'group') {
      const color = new tinycolor(background || defaultColor)
      color.setAlpha(0.3)
      return color.toRgbString()
    } else {
      return background || defaultColor
    }
  }, [type, background, defaultColor])
  return (
    <rect
      x={x}
      y={y}
      width={width}
      rx={3}
      height={height}
      className={miniNodeClassName}
      fill={lightenbG}
      stroke={type === 'group' ? background || defaultColor : undefined}
    />
  )
}

const miniNodeClassName = css({
  strokeWidth: 'calc(3px * var(--view-scale))'
})
export default WhiteboardMiniMap
