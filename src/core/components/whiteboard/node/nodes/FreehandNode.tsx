import { FreehandPoint, IWhiteboardNode, WhiteboardEvents } from '~/typings'
import { useLayoutEffect, useMemo, useState } from 'react'
import { rescalePoints } from '@/core/components/whiteboard/utils/points'
import { getStroke } from 'perfect-freehand'
import { getPenConfig, getSvgPathFromStroke } from '@/core/components/whiteboard/freehand/FreeHandLayer'
import { Colors } from '@/consts'
import { useDebounceEffect, useUpdateEffect } from '@/hooks'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'

const FreehandNode = ({ node, onClick }: { node: IWhiteboardNode & { type: 'freehand' }; onClick: (e: MouseEvent) => void }) => {
  const style = node.style
  const [innerPoints, setInnerPoints] = useState(node.points)
  const isArrayPoints = (points: FreehandPoint[] | FreehandPoint[][]): points is FreehandPoint[][] => {
    return Array.isArray(points[0][0])
  }
  const onResize = ({ resizingNode, resizeDir, realtimeBox }: WhiteboardEvents['nodeResize']) => {
    if (resizingNode.id !== node.id) return
    switch (resizeDir) {
      case 'right':
      case 'left': {
        if (isArrayPoints(innerPoints)) {
          const newPoints = innerPoints.map(o => rescalePoints('x', realtimeBox.width, o, true))
          setInnerPoints(newPoints)
        } else {
          const newPoints = rescalePoints('x', realtimeBox.width, innerPoints, true)
          setInnerPoints(newPoints)
        }

        break
      }
      case 'top':
      case 'bottom': {
        if (isArrayPoints(innerPoints)) {
          const newPoints = innerPoints.map(o => rescalePoints('y', realtimeBox.height, o, true))
          setInnerPoints(newPoints)
        } else {
          const newPoints = rescalePoints('y', realtimeBox.height, innerPoints, true)
          setInnerPoints(newPoints)
        }
        break
      }
      default: {
        if (isArrayPoints(innerPoints)) {
          let newPoints = innerPoints.map(o => rescalePoints('y', realtimeBox.height, o, true))
          newPoints = innerPoints.map(o => rescalePoints('x', realtimeBox.width, o, true))
          setInnerPoints(newPoints)
        } else {
          let newPoints = rescalePoints('y', realtimeBox.height, innerPoints, true)
          newPoints = rescalePoints('x', realtimeBox.width, newPoints, true)
          setInnerPoints(newPoints)
        }
      }
    }
  }
  const instance = useWhiteboardInstance()
  useLayoutEffect(() => {
    instance.addEventListener('nodeResize', onResize)
    return () => instance.removeEventListener('nodeResize', onResize)
  })
  useDebounceEffect(
    () => {
      if (innerPoints !== node.points) {
        instance.updateNode?.(node.id, n => ({ ...n, points: innerPoints }), false)
      }
    },
    [innerPoints],
    { wait: 300 }
  )
  useUpdateEffect(() => {
    if (node.width && node.height) {
      if (isArrayPoints(node.points)) {
        let newPoints = node.points.map(p => rescalePoints('y', node.height, p, true))
        newPoints = newPoints.map(p => rescalePoints('x', node.width, p, true))
        setInnerPoints(newPoints)
        console.log(node.points, newPoints)
      } else {
        let newPoints = rescalePoints('y', node.height, node.points, true)
        newPoints = rescalePoints('x', node.width, newPoints, true)
        setInnerPoints(newPoints)
      }
    }
  }, [node.x, node.y, node.width, node.height])
  const path = useMemo(() => {
    if (isArrayPoints(innerPoints)) {
      const config = getPenConfig(node.penType)
      return innerPoints.map(p => {
        const stroke = getStroke(p, { ...config, size: style?.width || 10 })
        return getSvgPathFromStroke(stroke)
      })
    } else {
      const config = getPenConfig(node.penType)
      const stroke = getStroke(innerPoints, { ...config, size: style?.width || 10 })
      return getSvgPathFromStroke(stroke)
    }
  }, [innerPoints])
  const color = !style?.color || style?.color === 'default' ? Colors.Font.Primary : style.color
  return (
    <svg style={{ pointerEvents: 'none', overflow: 'visible' }}>
      {Array.isArray(path) ? (
        path.map(p => <path fill={color} stroke={color} opacity={style?.opacity} d={p} pointerEvents={'all'} onClick={onClick} />)
      ) : (
        <path fill={color} stroke={color} opacity={style?.opacity} d={path} pointerEvents={'all'} onClick={onClick} />
      )}
    </svg>
  )
}

export default FreehandNode
