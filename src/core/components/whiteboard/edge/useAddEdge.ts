import { useAtom } from 'jotai/index'
import { EdgeOverlayStateAtom } from './EdgeOverlay'
import { useEffect } from 'react'
import { EdgePosition, IWhiteboardInstance, XYBox, XYPosition } from '~/typings'
import { useMemoizedFn, useRafFn } from '@/hooks'

const checkPosition = (nodeBox: XYBox, currentPos: XYPosition): EdgePosition => {
  if (currentPos.x <= nodeBox.x) {
    return 'left'
  }
  if (currentPos.x >= nodeBox.x + nodeBox.width) {
    return 'right'
  }
  if (currentPos.x > nodeBox.x && currentPos.x < nodeBox.x + nodeBox.width) {
    if (currentPos.y <= nodeBox.y) {
      return 'top'
    }
  }
  return 'bottom'
}

const checkAttachPosition = (nodeBox: XYBox, currentPos: XYPosition): EdgePosition => {
  const thirdWidth = nodeBox.width / 3
  if (currentPos.x >= nodeBox.x && currentPos.x <= nodeBox.x + thirdWidth) {
    return 'left'
  }
  if (currentPos.x >= nodeBox.x + nodeBox.width - thirdWidth && currentPos.x <= nodeBox.x + nodeBox.width) {
    return 'right'
  }
  if (currentPos.x >= nodeBox.x && currentPos.x <= nodeBox.x + nodeBox.width) {
    if (currentPos.y >= nodeBox.y && currentPos.y <= nodeBox.y + nodeBox.height / 2) {
      return 'top'
    }
    if (currentPos.y > nodeBox.y + nodeBox.height / 2 && currentPos.y <= nodeBox.y + nodeBox.height) {
      return 'bottom'
    }
  }
}

export default (instance: IWhiteboardInstance) => {
  const [overlayState, setOverlayState] = useAtom(EdgeOverlayStateAtom)
  const pointerMoveHandler = useMemoizedFn((e: PointerEvent) => {
    if (e.type === 'pointermove') {
      if (!overlayState.sourceNodeId) return
      let sourcePosition: EdgePosition | undefined = undefined,
        targetPosition: EdgePosition | undefined = undefined,
        targetNodeId: number | undefined = undefined
      const currentMousePos = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
      if (currentMousePos) {
        const sourceNode = instance.getNode?.(overlayState.sourceNodeId)
        if (sourceNode && sourceNode.width && sourceNode.height) {
          sourcePosition = checkPosition(sourceNode, currentMousePos)
        }
        const target = e.target
        if (target instanceof HTMLElement) {
          const dom = target.closest('[data-node-id]')
          if (dom) {
            const id = Number(dom.getAttribute('data-node-id')) as number
            const node = instance.getNode?.(id)
            if (id === sourceNode?.id) {
              sourcePosition = checkAttachPosition(sourceNode, currentMousePos)
            }
            if (id !== sourceNode?.id && node) {
              let conti = true
              if (sourceNode?.type === 'group') {
                const insideNodes = instance.groupOps?.getNodesInGroup(sourceNode.id)
                if (insideNodes?.some(i => i.id === id)) {
                  conti = false
                }
              }
              if (conti) {
                targetPosition = checkAttachPosition(node, currentMousePos)
                targetNodeId = id
              }
            }
          }
        }
        setOverlayState(s => ({ ...s, sourcePosition, targetPosition, targetNodeId, currentMousePosition: currentMousePos }))
      }
    }
  })
  const pointerUpHandler = useMemoizedFn((e: PointerEvent) => {
    if (e.button !== 0) {
      return
    }
    const { sourcePosition, sourceNodeId, targetNodeId, targetPosition } = overlayState
    if (sourceNodeId && sourcePosition && targetNodeId && targetPosition) {
      e.preventDefault()
      const alreadyHave = instance.edgeOps?.hasEdge(sourceNodeId, sourcePosition, targetNodeId, targetPosition)
      if (!alreadyHave) {
        instance.edgeOps?.insertEdge({
          sourcePosition: sourcePosition,
          sourceId: sourceNodeId,
          targetPosition: targetPosition,
          targetId: targetNodeId
        })
      }
    }
    setTimeout(() => {
      setOverlayState({})
    })
  })
  const rafPointerMove = useRafFn(pointerMoveHandler)
  useEffect(() => {
    if (overlayState.isAdding) {
      const container = instance.getOutestContainerNode?.()
      if (container) {
        container.addEventListener('pointermove', rafPointerMove)
        container.addEventListener('pointerup', pointerUpHandler)
        return () => {
          container.removeEventListener('pointermove', rafPointerMove)
          container.removeEventListener('pointerup', pointerUpHandler)
        }
      }
    }
  }, [overlayState.isAdding])
}
