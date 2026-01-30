import { memo, useEffect, useRef, useState } from 'react'
import { IWhiteboardNode, XYPosition } from '~/typings'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { assignProperties } from '@/utils'
import getClosestLink from '@/core/components/whiteboard/node/mindmap/drag/getClosestNodeLink'
import { debounce } from 'lodash'
import getAttachableNodes from '@/core/components/whiteboard/node/mindmap/utils/getAttachableNodes'
export default memo(() => {
  const [fakeMindmapNode, setFakeMindmapNode] = useState<{
    element: HTMLElement
    node: IWhiteboardNode
    // element from pointer offset
    offset: XYPosition
    initialPointer: XYPosition
  }>()
  const instance = useWhiteboardInstance()
  const overlayRef = useRef<HTMLElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    const overlay = overlayRef.current
    if (fakeMindmapNode && overlay) {
      const { offset, initialPointer, node, element } = fakeMindmapNode

      const debounced = debounce((e: PointerEvent) => {
        const windowPos = {
          x: e.clientX + offset.x,
          y: e.clientY + offset.y
        }
        const transformed = instance.coordOps?.transformWindowPositionToPosition(windowPos)
        if (transformed) {
          const targetMindmapNode = getClosestLink({ ...node, x: transformed.x, y: transformed.y }, instance, e)
          instance.emit({
            type: 'nodeDrag',
            draggingNode: { ...node, x: transformed.x, y: transformed.y },
            attachableNode: targetMindmapNode,
            delta: offset,
            ignoreSnap: true,
            nodeElement: element
          })
        }
      }, 0)
      const pointerHandler = (e: PointerEvent) => {
        if (e.type === 'pointermove') {
          const scale = instance.getTransform?.().scale
          const realScale = scale
          if (moved.current === false && (Math.abs(e.clientX - initialPointer.x) > 2 || Math.abs(e.clientY - initialPointer.y) > 2)) {
            moved.current = true
            overlay.style.pointerEvents = 'auto'
            overlay.appendChild(fakeMindmapNode.element)
            fakeMindmapNode.element.style.boxShadow = '0px 0px 0px 3px var(--select-color)'
            fakeMindmapNode.element.style.transformOrigin = 'left top'
            fakeMindmapNode.element.style.transform = `translate(${initialPointer.x + offset.x}px, ${
              initialPointer.y + offset.y
            }px) scale(${realScale})`
          }
          if (!moved.current) return
          debounced(e)
          fakeMindmapNode.element.style.transform = `translate(${e.clientX + offset.x}px, ${e.clientY + offset.y}px) scale(${realScale})`
        }
        if (e.type === 'pointerup') {
          setFakeMindmapNode(undefined)
          if (moved.current) {
            const windowPos = {
              x: e.clientX + offset.x,
              y: e.clientY + offset.y
            }
            const transformed = instance.coordOps?.transformWindowPositionToPosition(windowPos)
            if (transformed) {
              instance.emit({
                type: 'nodeDragEnd',
                attachableNode: getClosestLink({ ...node, x: transformed.x, y: transformed.y }, instance, e),
                draggingNode: { ...node, x: transformed.x, y: transformed.y }
              })
            }
          }
          moved.current = false
        }
      }
      document.addEventListener('pointermove', pointerHandler)
      document.addEventListener('pointerup', pointerHandler)
      return () => {
        document.removeEventListener('pointermove', pointerHandler)
        document.removeEventListener('pointerup', pointerHandler)
      }
    }
  }, [fakeMindmapNode])
  assignProperties(instance, {
    mindmapOps: {
      ...instance.mindmapOps,
      startDragMindmapChild: (nodeId, e) => {
        getAttachableNodes(instance, nodeId)
        const nodeDOM = instance.nodeOps?.getNodeDOM(nodeId)
        const node = instance.getNode?.(nodeId)
        if (nodeDOM && node) {
          const cloned = nodeDOM.cloneNode(true)
          const nodeBounding = nodeDOM.getBoundingClientRect()
          const pointerXY = {
            x: e.clientX,
            y: e.clientY
          }
          setFakeMindmapNode({
            element: cloned,
            initialPointer: pointerXY,
            node,
            offset: {
              x: nodeBounding.x - pointerXY.x,
              y: nodeBounding.y - pointerXY.y
            }
          })
        }
      },
      getFakeNodeBox: nodeId => {
        if (fakeMindmapNode && moved.current) {
          if (fakeMindmapNode.node.id === nodeId) {
            const bounding = fakeMindmapNode.element.getBoundingClientRect()
            console.log(bounding, fakeMindmapNode)
            const transformedXY = instance.coordOps?.transformWindowPositionToPosition({
              x: bounding.x,
              y: bounding.y
            })
            if (!transformedXY) return
            console.log(transformedXY)
            return {
              top: transformedXY.y,
              left: transformedXY.x,
              width: fakeMindmapNode.node.width!,
              height: fakeMindmapNode.node.height!
            }
          }
        }
      }
    }
  })

  if (fakeMindmapNode) {
    return (
      <div
        ref={overlayRef}
        style={{
          pointerEvents: 'none',
          position: 'fixed',
          inset: 0,
          cursor: 'grab',
          width: '100%',
          height: '100%',
          zIndex: 999,
          opacity: 0.8
        }}
      ></div>
    )
  }

  return null
})
