import { useWhiteboardNodes } from '@/core/components/whiteboard/StateHooks'
import { memo, useEffect, useRef, useState } from 'react'
import { IWhiteboardEvent, IWhiteboardNode, XYPosition } from '~/typings'
import _ from 'lodash'
import { useMemoizedFn, useSelectGlobalAtomValue } from '@/hooks'
import { SettingAtom } from '@/core'
import { Colors } from '@/consts'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'

type ISnapState = {
  circles: { x: number; y: number }[]
  lines: { startX: number; startY: number; endX: number; endY: number }[]
}

const DISTANCE_TOLERANCE = 15
const MAX_DISTANCE = 1000
const isNear = (pos1: number, pos2: number, scale: number) => {
  if (Math.abs(pos1 - pos2) < DISTANCE_TOLERANCE) {
    return true
  }
  return false
}

const getMinMaxOfArray = (arr: number[]) => {
  const copyed = arr.slice()
  copyed.sort((b, a) => b - a)
  return {
    max: copyed[copyed.length - 1],
    min: copyed[0]
  }
}

const SnapDragLayer = memo(() => {
  const allNodes = useWhiteboardNodes()
  const [snapState, setSnapState] = useState<ISnapState>()
  const instance = useWhiteboardInstance()
  const snap = useSelectGlobalAtomValue(SettingAtom, s => s.whiteboard.snapToObject)
  const handler = useMemoizedFn((e: IWhiteboardEvent) => {
    switch (e.type) {
      case 'nodeDragStart': {
        const { draggingNode } = e
        const nodes = Array.from(allNodes.values())
        cachedNodesYBoxMap.current.clear()
        cachedNodesXBoxMap.current.clear()
        nodes.forEach(n => {
          if (n.id === draggingNode.id) return
          // ignore mindmap and mindmap sub children
          if (n.type === 'mindmap') return
          if (n.rootId) return
          if (n.y !== undefined && n.height) {
            const firstYSet = cachedNodesYBoxMap.current.get(n.y) || new Set()
            firstYSet.add(n)
            const secondYSet = cachedNodesYBoxMap.current.get(n.y + n.height) || new Set()
            secondYSet.add(n)
            const thirdYSet = cachedNodesYBoxMap.current.get(n.y + n.height / 2) || new Set()
            thirdYSet.add(n)
            cachedNodesYBoxMap.current.set(n.y, firstYSet)
            cachedNodesYBoxMap.current.set(n.y + n.height, secondYSet)
            cachedNodesYBoxMap.current.set(n.y + n.height / 2, thirdYSet)
          }
          if (n.x !== undefined && n.width) {
            const firstXSet = cachedNodesXBoxMap.current.get(n.x) || new Set()
            firstXSet.add(n)
            const secondXSet = cachedNodesXBoxMap.current.get(n.x + n.width) || new Set()
            secondXSet.add(n)
            const thirdXSet = cachedNodesXBoxMap.current.get(n.x + n.width / 2) || new Set()
            thirdXSet.add(n)
            cachedNodesXBoxMap.current.set(n.x, firstXSet)
            cachedNodesXBoxMap.current.set(n.x + n.width, secondXSet)
            cachedNodesXBoxMap.current.set(n.x + n.width / 2, thirdXSet)
          }
        })
        break
      }
      case 'nodeResizeStart': {
        const { resizingNode } = e
        const nodes = Array.from(allNodes.values())
        nodes.forEach(n => {
          if (n.id === resizingNode.id) return
          if (n.type === 'mindmap') return
          if (n.rootId) return
          if (n.y !== undefined && n.height) {
            const firstYSet = cachedNodesYBoxMap.current.get(n.y) || new Set()
            firstYSet.add(n)
            const secondYSet = cachedNodesYBoxMap.current.get(n.y + n.height) || new Set()
            secondYSet.add(n)
            const thirdYSet = cachedNodesYBoxMap.current.get(n.y + n.height / 2) || new Set()
            thirdYSet.add(n)
            cachedNodesYBoxMap.current.set(n.y, firstYSet)
            cachedNodesYBoxMap.current.set(n.y + n.height, secondYSet)
            cachedNodesYBoxMap.current.set(n.y + n.height / 2, thirdYSet)
          }
          if (n.x !== undefined && n.width) {
            const firstXSet = cachedNodesXBoxMap.current.get(n.x) || new Set()
            firstXSet.add(n)
            const secondXSet = cachedNodesXBoxMap.current.get(n.x + n.width) || new Set()
            secondXSet.add(n)
            const thirdXSet = cachedNodesXBoxMap.current.get(n.x + n.width / 2) || new Set()
            thirdXSet.add(n)
            cachedNodesXBoxMap.current.set(n.x, firstXSet)
            cachedNodesXBoxMap.current.set(n.x + n.width, secondXSet)
            cachedNodesXBoxMap.current.set(n.x + n.width / 2, thirdXSet)
          }
        })
        break
      }
      case 'nodeDragEnd': {
        cachedNodesXBoxMap.current.clear()
        cachedNodesYBoxMap.current.clear()
        setSnapState(undefined)
        break
      }
      case 'nodeResizeEnd': {
        cachedNodesXBoxMap.current.clear()
        cachedNodesYBoxMap.current.clear()
        setSnapState(undefined)
        break
      }
      case 'nodeDrag': {
        const { draggingNode, nodeElement, attachableNode, ignoreSnap } = e
        if (!draggingNode.width || !draggingNode.height || attachableNode || ignoreSnap) return
        const scale = instance.getTransform?.().scale ?? 1
        // mouse move box
        const mouseBox = {
          left: draggingNode.x,
          top: draggingNode.y,
          right: draggingNode.x + draggingNode.width,
          bottom: draggingNode.y + draggingNode.height,
          centerX: draggingNode.x + draggingNode.width / 2,
          centerY: draggingNode.y + draggingNode.height / 2,
          width: draggingNode.width,
          height: draggingNode.height
        }
        const points: XYPosition & { type: 'centerX' | 'centerY' | 'top' | 'left' | 'right' | 'bottom' }[] = []
        const lines: {
          startX: number
          startY: number
          endX: number
          endY: number
        }[] = []
        // find nearest x nodes
        Array.from(cachedNodesXBoxMap.current.entries()).forEach(([x, nodes]) => {
          let boxXNearPos = 'none'
          if (isNear(x, mouseBox.left, scale)) boxXNearPos = 'left'
          if (boxXNearPos === 'none' && isNear(x, mouseBox.centerX, scale)) boxXNearPos = 'centerX'
          if (boxXNearPos === 'none' && isNear(x, mouseBox.right, scale)) boxXNearPos = 'right'
          if (boxXNearPos !== 'none') {
            nodes.forEach(n => {
              const threePoints = {
                left: n.x,
                center: n.x + n.width / 2,
                right: n.x + n.width
              }
              if (threePoints.left === x) {
                points.push({
                  x: n.x,
                  y: n.y,
                  type: boxXNearPos
                })
                points.push({
                  x: n.x,
                  y: n.y + n.height,
                  type: boxXNearPos
                })
              }
              if (threePoints.center === x) {
                points.push({
                  x: n.x + n.width / 2,
                  y: n.y + n.height / 2,
                  type: boxXNearPos
                })
              }
              if (threePoints.right === x) {
                points.push({
                  x: n.x + n.width,
                  y: n.y,
                  type: boxXNearPos
                })
                points.push({
                  x: n.x + n.width,
                  y: n.y + n.height,
                  type: boxXNearPos
                })
              }
            })
            return
          }
        })
        // find nearset y nodes
        Array.from(cachedNodesYBoxMap.current.entries()).forEach(([y, nodes]) => {
          let boxYNearPos = 'none'
          if (isNear(y, mouseBox.top, scale)) boxYNearPos = 'top'
          if (boxYNearPos === 'none' && isNear(y, mouseBox.centerY, scale)) boxYNearPos = 'centerY'
          if (boxYNearPos === 'none' && isNear(y, mouseBox.bottom, scale)) boxYNearPos = 'bottom'
          if (boxYNearPos !== 'none') {
            nodes.forEach(n => {
              const threePoints = {
                top: n.y,
                center: n.y + n.height / 2,
                bottom: n.y + n.height
              }
              if (threePoints.top === y) {
                points.push({
                  x: n.x,
                  y: n.y,
                  type: boxYNearPos
                })
                points.push({
                  x: n.x + n.width,
                  y: n.y,
                  type: boxYNearPos
                })
              }
              if (threePoints.center === y) {
                points.push({
                  x: n.x + n.width / 2,
                  y: n.y + n.height / 2,
                  type: boxYNearPos
                })
              }
              if (threePoints.bottom === y) {
                points.push({
                  x: n.x,
                  y: n.y + n.height,
                  type: boxYNearPos
                })
                points.push({
                  x: n.x + n.width,
                  y: n.y + n.height,
                  type: boxYNearPos
                })
              }
            })
          }
        })
        if (points.length) {
          const have = {
            left: false,
            top: false,
            right: false,
            bottom: false,
            centerX: false,
            centerY: false
          }
          const nextBox = {
            left: mouseBox.left,
            top: mouseBox.top
          }

          const validPoints = points.filter(p => {
            if (p.type === 'centerX') {
              if (Math.abs(p.y - mouseBox.centerY) > MAX_DISTANCE) return false
              nextBox.left = p.x - mouseBox.width / 2
            }
            if (p.type === 'centerY') {
              if (Math.abs(p.x - mouseBox.centerX) > MAX_DISTANCE) return false
              nextBox.top = p.y - mouseBox.height / 2
            }
            if (p.type === 'left') {
              if (Math.abs(p.y - mouseBox.centerY) > MAX_DISTANCE + mouseBox.height / 2) return false
              nextBox.left = p.x
            }
            if (p.type === 'right') {
              if (Math.abs(p.y - mouseBox.centerY) > MAX_DISTANCE + mouseBox.height / 2) return false
              nextBox.left = p.x - mouseBox.width
            }
            if (p.type === 'bottom') {
              if (Math.abs(p.x - mouseBox.centerX) > MAX_DISTANCE + mouseBox.width / 2) return false
              nextBox.top = p.y - mouseBox.height
            }
            if (p.type === 'top') {
              if (Math.abs(p.x - mouseBox.centerX) > MAX_DISTANCE + mouseBox.width / 2) return false
              nextBox.top = p.y
            }
            return true
          })
          nodeElement.style.transform = `translate(${nextBox.left}px, ${nextBox.top}px)`
          mouseBox.left = nextBox.left
          mouseBox.top = nextBox.top
          mouseBox.right = mouseBox.left + mouseBox.width
          mouseBox.bottom = mouseBox.top + mouseBox.height
          mouseBox.centerX = mouseBox.left + mouseBox.width / 2
          mouseBox.centerY = mouseBox.top + mouseBox.height / 2

          const finalBox = mouseBox
          // recalculate lines and points for final box
          const recalculatePoints = validPoints.filter(p => {
            if (p.type === 'top' && p.y === finalBox.top) {
              have.top = true
              return true
            }
            if (p.type === 'left' && p.x === finalBox.left) {
              have.left = true
              return true
            }
            if (p.type === 'right' && p.x === finalBox.left + finalBox.width) {
              have.right = true
              return true
            }
            if (p.type === 'bottom' && p.y === finalBox.top + finalBox.height) {
              have.bottom = true
              return true
            }
            if (p.type === 'centerY' && p.y === finalBox.top + finalBox.height / 2) {
              have.centerY = true
              return true
            }
            if (p.type === 'centerX' && p.x === finalBox.left + finalBox.width / 2) {
              have.centerX = true
              return true
            }
            return false
          })

          if (have.top) {
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.top,
              type: 'top'
            })
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.top,
              type: 'top'
            })
          }
          if (have.left) {
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.top,
              type: 'left'
            })
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.bottom,
              type: 'left'
            })
          }
          if (have.bottom) {
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.bottom,
              type: 'bottom'
            })
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.bottom,
              type: 'bottom'
            })
          }
          if (have.right) {
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.top,
              type: 'right'
            })
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.bottom,
              type: 'right'
            })
          }
          if (have.centerX) {
            recalculatePoints.push({
              x: mouseBox.centerX,
              y: mouseBox.centerY,
              type: 'centerX'
            })
          }
          if (have.centerY) {
            recalculatePoints.push({
              x: mouseBox.centerX,
              y: mouseBox.centerY,
              type: 'centerY'
            })
          }

          const groupedPoints = _.groupBy(recalculatePoints, p => p.type)
          Object.entries(groupedPoints).forEach(entry => {
            switch (entry[0]) {
              case 'top':
              case 'bottom':
              case 'centerY': {
                const { min, max } = getMinMaxOfArray(entry[1].map(i => i.x))
                lines.push({
                  startX: min,
                  startY: entry[1][0].y,
                  endX: max,
                  endY: entry[1][0].y
                })
                break
              }
              case 'left':
              case 'right':
              case 'centerX': {
                const { min, max } = getMinMaxOfArray(entry[1].map(i => i.y))
                lines.push({
                  startX: entry[1][0].x,
                  startY: min,
                  endX: entry[1][0].x,
                  endY: max
                })
                break
              }
            }
          })
          setSnapState({
            circles: recalculatePoints,
            lines
          })
          throw ''
        } else {
          setSnapState(undefined)
        }
        break
      }
      case 'nodeResize': {
        const { resizingNode, pointerBox, resizeDir, ignoreSnap } = e
        // 导图或子节点不能snap
        if (resizingNode.type === 'mindmap' || resizingNode.rootId || ignoreSnap) return
        if (!resizingNode.width || !resizingNode.height) return
        const scale = instance.getTransform?.().scale ?? 1
        // 需要node真实的box和mouse的box
        // mouse move box
        const mouseBox = {
          ...pointerBox,
          centerX: pointerBox.left + pointerBox.width / 2,
          centerY: pointerBox.top + pointerBox.height / 2,
          right: pointerBox.left + pointerBox.width,
          bottom: pointerBox.top + pointerBox.height
        }
        const points: XYPosition & { type: 'centerX' | 'centerY' | 'top' | 'left' | 'right' | 'bottom' }[] = []
        const lines: {
          startX: number
          startY: number
          endX: number
          endY: number
        }[] = []
        // find nearest x nodes
        Array.from(cachedNodesXBoxMap.current.entries()).forEach(([x, nodes]) => {
          let boxXNearPos = 'none'
          if (isNear(x, mouseBox.left, scale)) boxXNearPos = 'left'
          if (boxXNearPos === 'none' && isNear(x, mouseBox.centerX, scale)) boxXNearPos = 'centerX'
          if (boxXNearPos === 'none' && isNear(x, mouseBox.right, scale)) boxXNearPos = 'right'
          if (boxXNearPos !== 'none') {
            nodes.forEach(n => {
              const threePoints = {
                left: n.x,
                center: n.x + n.width / 2,
                right: n.x + n.width
              }
              if (threePoints.left === x) {
                points.push({
                  x: n.x,
                  y: n.y,
                  type: boxXNearPos
                })
                points.push({
                  x: n.x,
                  y: n.y + n.height,
                  type: boxXNearPos
                })
              }
              if (threePoints.center === x) {
                points.push({
                  x: n.x + n.width / 2,
                  y: n.y + n.height / 2,
                  type: boxXNearPos
                })
              }
              if (threePoints.right === x) {
                points.push({
                  x: n.x + n.width,
                  y: n.y,
                  type: boxXNearPos
                })
                points.push({
                  x: n.x + n.width,
                  y: n.y + n.height,
                  type: boxXNearPos
                })
              }
            })
            return
          }
        })
        // find nearset y nodes
        Array.from(cachedNodesYBoxMap.current.entries()).forEach(([y, nodes]) => {
          let boxYNearPos = 'none'
          if (isNear(y, mouseBox.top, scale)) boxYNearPos = 'top'
          if (boxYNearPos === 'none' && isNear(y, mouseBox.centerY, scale)) boxYNearPos = 'centerY'
          if (boxYNearPos === 'none' && isNear(y, mouseBox.bottom, scale)) boxYNearPos = 'bottom'
          if (boxYNearPos !== 'none') {
            nodes.forEach(n => {
              const threePoints = {
                top: n.y,
                center: n.y + n.height / 2,
                bottom: n.y + n.height
              }
              if (threePoints.top === y) {
                points.push({
                  x: n.x,
                  y: n.y,
                  type: boxYNearPos
                })
                points.push({
                  x: n.x + n.width,
                  y: n.y,
                  type: boxYNearPos
                })
              }
              if (threePoints.center === y) {
                points.push({
                  x: n.x + n.width / 2,
                  y: n.y + n.height / 2,
                  type: boxYNearPos
                })
              }
              if (threePoints.bottom === y) {
                points.push({
                  x: n.x,
                  y: n.y + n.height,
                  type: boxYNearPos
                })
                points.push({
                  x: n.x + n.width,
                  y: n.y + n.height,
                  type: boxYNearPos
                })
              }
            })
          }
        })
        if (points.length) {
          const have = {
            left: false,
            top: false,
            right: false,
            bottom: false,
            centerX: false,
            centerY: false
          }
          const nextBox = {
            left: mouseBox.left,
            top: mouseBox.top,
            width: mouseBox.width,
            height: mouseBox.height
          }

          const validPoints = points.filter(p => {
            // resize no centerX or centerY
            // left, resize left top / left bottom, change left
            if (p.type === 'left') {
              if (Math.abs(p.y - mouseBox.centerY) > MAX_DISTANCE + mouseBox.height / 2) return false
              nextBox.left = p.x
            }
            // right, resize right top / right bottom, change width
            if (p.type === 'right') {
              if (Math.abs(p.y - mouseBox.centerY) > MAX_DISTANCE + mouseBox.height / 2) return false
              nextBox.width = p.x - nextBox.left
            }
            // bottom, resize left bottom / right bottom, change height
            if (p.type === 'bottom') {
              if (Math.abs(p.x - mouseBox.centerX) > MAX_DISTANCE + mouseBox.width / 2) return false
              nextBox.height = p.y - nextBox.top
            }
            // top, resize left top / right top, change top
            if (p.type === 'top') {
              if (Math.abs(p.x - mouseBox.centerX) > MAX_DISTANCE + mouseBox.width / 2) return false
              nextBox.top = p.y
            }
            return true
          })
          const topDelta = nextBox.top - mouseBox.top
          const leftDelta = nextBox.left - mouseBox.left
          const ele = e.nodeElement
          ele.style.width = `${nextBox.width - leftDelta}px`
          ele.style.height = resizingNode.resized || !['left', 'right'].includes(resizeDir) ? `${nextBox.height - topDelta}px` : 'auto'
          ele.style.transform = `translate(${nextBox.left}px, ${nextBox.top}px)`
          mouseBox.left = nextBox.left
          mouseBox.top = nextBox.top
          mouseBox.right = mouseBox.left + nextBox.width
          mouseBox.bottom = mouseBox.top + nextBox.height
          mouseBox.centerX = mouseBox.left + nextBox.width / 2
          mouseBox.centerY = mouseBox.top + nextBox.height / 2
          mouseBox.width = nextBox.width
          mouseBox.height = nextBox.height

          const finalBox = mouseBox
          // recalculate lines and points for final box
          const recalculatePoints = validPoints.filter(p => {
            if (p.type === 'top' && p.y === finalBox.top) {
              have.top = true
              return true
            }
            if (p.type === 'left' && p.x === finalBox.left) {
              have.left = true
              return true
            }
            if (p.type === 'right' && p.x === finalBox.left + finalBox.width) {
              have.right = true
              return true
            }
            if (p.type === 'bottom' && p.y === finalBox.top + finalBox.height) {
              have.bottom = true
              return true
            }
            return false
          })

          if (have.top) {
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.top,
              type: 'top'
            })
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.top,
              type: 'top'
            })
          }
          if (have.left) {
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.top,
              type: 'left'
            })
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.bottom,
              type: 'left'
            })
          }
          if (have.bottom) {
            recalculatePoints.push({
              x: mouseBox.left,
              y: mouseBox.bottom,
              type: 'bottom'
            })
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.bottom,
              type: 'bottom'
            })
          }
          if (have.right) {
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.top,
              type: 'right'
            })
            recalculatePoints.push({
              x: mouseBox.right,
              y: mouseBox.bottom,
              type: 'right'
            })
          }
          if (have.centerX) {
            recalculatePoints.push({
              x: mouseBox.centerX,
              y: mouseBox.centerY,
              type: 'centerX'
            })
          }
          if (have.centerY) {
            recalculatePoints.push({
              x: mouseBox.centerX,
              y: mouseBox.centerY,
              type: 'centerY'
            })
          }

          const groupedPoints = _.groupBy(recalculatePoints, p => p.type)
          Object.entries(groupedPoints).forEach(entry => {
            switch (entry[0]) {
              case 'top':
              case 'bottom':
              case 'centerY': {
                const { min, max } = getMinMaxOfArray(entry[1].map(i => i.x))
                lines.push({
                  startX: min,
                  startY: entry[1][0].y,
                  endX: max,
                  endY: entry[1][0].y
                })
                break
              }
              case 'left':
              case 'right':
              case 'centerX': {
                const { min, max } = getMinMaxOfArray(entry[1].map(i => i.y))
                lines.push({
                  startX: entry[1][0].x,
                  startY: min,
                  endX: entry[1][0].x,
                  endY: max
                })
                break
              }
            }
          })
          setSnapState({
            circles: recalculatePoints,
            lines
          })
        } else {
          setSnapState(undefined)
        }
        break
      }
    }
  })
  useEffect(() => {
    if (snap) {
      instance.addEventListener('nodeDragStart', handler)
      instance.addEventListener('nodeResizeStart', handler)
      instance.addEventListener('nodeDragEnd', handler)
      instance.addEventListener('nodeResizeEnd', handler)
      instance.addEventListener('nodeDrag', handler)
      instance.addEventListener('nodeResize', handler)
      return () => {
        instance.removeEventListener('nodeDragStart', handler)
        instance.removeEventListener('nodeResizeStart', handler)
        instance.removeEventListener('nodeDragEnd', handler)
        instance.removeEventListener('nodeResizeEnd', handler)
        instance.removeEventListener('nodeDrag', handler)
        instance.removeEventListener('nodeResize', handler)
      }
    }
  }, [snap])
  // All Y
  const cachedNodesYBoxMap = useRef(new Map<number, Set<IWhiteboardNode>>())
  // All X
  const cachedNodesXBoxMap = useRef(new Map<number, Set<IWhiteboardNode>>())

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 100,
        opacity: 0.4
      }}
    >
      {snapState?.circles.map(i => <circle r={4} transform={`translate(${i.x},${i.y})`} fill={Colors.Common.SelectColor}></circle>)}
      {snapState?.lines?.map(i => (
        <line strokeWidth={2} stroke={Colors.Common.SelectColor} x1={i.startX} y1={i.startY} x2={i.endX} y2={i.endY} />
      ))}
    </svg>
  )
})

export default SnapDragLayer
