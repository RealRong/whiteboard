import { useAtom } from 'jotai/index'
import { EdgeOverlayStateAtom } from './EdgeOverlay'
import { useEffect } from 'react'
import { EdgePosition, IWhiteboardInstance, XYBox, XYPosition } from '~/typings'
import { useMemoizedFn, useRafFn } from '@/hooks'


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
      const direction = overlayState.repositionDirection
      if (!direction) return
      if (!overlayState.sourceNodeId && !overlayState.targetNodeId) return
      let sourcePosition: EdgePosition | undefined = direction === 'source' ? undefined : overlayState.sourcePosition,
        targetPosition: EdgePosition | undefined = direction === 'target' ? undefined : overlayState.targetPosition,
        targetNodeId: number | undefined = direction === 'target' ? undefined : overlayState.targetNodeId,
        sourceNodeId: number | undefined = direction === 'source' ? undefined : overlayState.sourceNodeId
      const currentMousePos = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
      if (currentMousePos) {
        if (direction === 'source') {
          if (!targetNodeId) return
          const target = e.target
          if (target instanceof HTMLElement) {
            const dom = target.closest('[data-node-id]')
            if (dom) {
              const id = Number(dom.getAttribute('data-node-id')) as number
              const node = instance.getNode?.(id)
              if (id !== targetNodeId && node) {
                sourcePosition = checkAttachPosition(node, currentMousePos)
                sourceNodeId = id
                console.log(sourcePosition)
              }
            }
          }
          setOverlayState(s => ({
            ...s,
            sourcePosition,
            sourceNodeId,
            targetPosition,
            targetNodeId,
            currentMousePosition: currentMousePos
          }))
        } else {
          if (!sourceNodeId) return
          const target = e.target
          if (target instanceof HTMLElement) {
            const dom = target.closest('[data-node-id]')
            if (dom) {
              const id = Number(dom.getAttribute('data-node-id')) as number
              const node = instance.getNode?.(id)
              if (id !== sourceNodeId && node) {
                targetPosition = checkAttachPosition(node, currentMousePos)
                targetNodeId = id
              }
            }
          }
          setOverlayState(s => ({ ...s, sourcePosition, targetPosition, targetNodeId, currentMousePosition: currentMousePos }))
        }
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
      if (overlayState.isReposition && overlayState.currentEdgeId) {
        instance.updateWhiteboard?.(w => {
          const o = w.edges?.get(overlayState.currentEdgeId)
          if (o) {
            w.edges?.set(o.id, { ...o, sourceId: sourceNodeId, targetId: targetNodeId, targetPosition, sourcePosition })
          }
        }, true)
      }
    }
    setTimeout(() => {
      setOverlayState({})
    })
  })
  const rafPointerMove = useRafFn(pointerMoveHandler)
  useEffect(() => {
    if (overlayState.isReposition) {
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
  }, [overlayState.isReposition])
}
