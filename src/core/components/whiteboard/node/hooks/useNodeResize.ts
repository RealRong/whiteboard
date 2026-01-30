import { Box, IWhiteboardInstance, IWhiteboardNode, XYPosition } from '~/typings'
import { ResizeDirection } from 're-resizable'
import { useRef } from 'react'
import { calculateSelectionBox } from '@/utils'
import { DEFAULT_NODE_WIDTH } from '@/core/components/whiteboard/node/hooks/useNodeSize'

export default (node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  const startPoint = useRef<XYPosition>()
  const handleResizeStart = (e: MouseEvent) => {
    instance.emit?.({
      type: 'nodeResizeStart',
      resizingNode: node
    })
  }

  const handleResize = (
    e: PointerEvent,
    dir: ResizeDirection,
    elementRef: HTMLElement
  ): {
    direction: 'x' | 'y' | 'both'
    box: Box
  } => {
    const nodeFuncs = instance.values.ID_TO_NODE_MAP.get(node.id)
    if (!nodeFuncs) {
      throw new Error('Can not find node funcs!')
    }
    const nodeRealtimeBox = nodeFuncs.getRealtimeBox()
    if (!nodeRealtimeBox) {
      throw new Error('Can not find node box!')
    }
    if (!node.width || !node.height) {
      throw new Error('Can not find node box!')
    }

    const direction = ['top', 'bottom'].includes(dir) ? 'y' : ['left', 'right'].includes(dir) ? 'x' : 'both'
    const mousePosition = instance.coordOps?.transformWindowPositionToPosition({
      x: e.clientX,
      y: e.clientY
    })
    if (!mousePosition) throw 'Failed to transform coord!'
    if (node.type !== 'group') {
      let endPoint: XYPosition
      switch (dir) {
        case 'bottom':
        case 'top': {
          // top right / bottom right
          endPoint = {
            x: node.x + node.width,
            y: mousePosition.y
          }
          break
        }
        case 'right': {
          // bottom right
          endPoint = {
            x: mousePosition.x,
            y: nodeRealtimeBox.top + nodeRealtimeBox.height
          }
          break
        }
        case 'left': {
          // left bottom
          endPoint = {
            x: mousePosition.x,
            y: nodeRealtimeBox.top + nodeRealtimeBox.height
          }
          break
        }
        case 'topLeft':
        case 'topRight':
        case 'bottomLeft':
        case 'bottomRight': {
          endPoint = {
            x: mousePosition.x,
            y: mousePosition.y
          }
          break
        }
      }
      const selectionBox = calculateSelectionBox({
        startPoint: ['bottomRight', 'bottom', 'right'].includes(dir)
          ? // top left
            { x: node.x, y: node.y }
          : ['top', 'topRight'].includes(dir)
            ? // bottom left
              {
                x: node.x,
                y: node.y + node.height
              }
            : // top right
              ['left', 'bottomLeft'].includes(dir)
              ? {
                  x: node.x + node.width,
                  y: node.y
                }
              : // bottom right
                {
                  x: node.x + node.width,
                  y: node.y + node.height
                },
        endPoint: endPoint
      })
      selectionBox.width = Math.max(DEFAULT_NODE_WIDTH, selectionBox.width)
      instance.emit?.({
        type: 'nodeResize',
        resizingNode: node,
        resizeDir: dir,
        ignoreSnap: node.type === 'freehand',
        pointerBox: selectionBox,
        nodeElement: elementRef,
        realtimeBox: nodeRealtimeBox
      })
    }
    return {
      box: nodeRealtimeBox,
      direction
    }
  }

  const handleResizeEnd = () => {
    startPoint.current = undefined
    instance.emit?.({
      type: 'nodeResizeEnd'
    })
    const realtimeBox = instance.values.ID_TO_NODE_MAP.get(node.id)?.getRealtimeBox()
    if (!realtimeBox) {
      throw new Error('Can not get node box!')
    }
    return realtimeBox
  }

  return {
    handleResize,
    handleResizeEnd,
    handleResizeStart
  }
}
