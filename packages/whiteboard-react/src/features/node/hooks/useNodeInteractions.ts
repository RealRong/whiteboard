import type { NodeId } from '@whiteboard/core/types'
import { useEffect, useRef } from 'react'
import { useInternalInstance as useInstance, useView } from '../../../runtime/hooks'
import { useWindowPointerSession } from '../../../runtime/interaction/useWindowPointerSession'
import { createNodeDragSession } from './drag/session'
import { createNodeTransformSession } from './transform/session'

const DOUBLE_CLICK_IGNORE_SELECTOR = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  '[data-input-role]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

export const useNodeInteractions = () => {
  const instance = useInstance()
  const dragSessionRef = useRef<ReturnType<typeof createNodeDragSession> | null>(null)
  const transformSessionRef = useRef<ReturnType<typeof createNodeTransformSession> | null>(null)

  if (!dragSessionRef.current) {
    dragSessionRef.current = createNodeDragSession(instance)
  }
  if (!transformSessionRef.current) {
    transformSessionRef.current = createNodeTransformSession(instance)
  }

  const dragSession = dragSessionRef.current
  const transformSession = transformSessionRef.current
  const dragPointerId = useView(dragSession.pointer)
  const transformPointerId = useView(transformSession.pointer)

  useWindowPointerSession({
    pointerId: dragPointerId,
    onPointerMove: dragSession.onWindowPointerMove,
    onPointerUp: dragSession.onWindowPointerUp,
    onPointerCancel: dragSession.onWindowPointerCancel,
    onBlur: dragSession.onWindowBlur,
    onKeyDown: dragSession.onWindowKeyDown
  })

  useWindowPointerSession({
    pointerId: transformPointerId,
    onPointerMove: transformSession.onWindowPointerMove,
    onPointerUp: transformSession.onWindowPointerUp,
    onPointerCancel: transformSession.onWindowPointerCancel,
    onBlur: transformSession.onWindowBlur,
    onKeyDown: transformSession.onWindowKeyDown
  })

  useEffect(() => () => {
    dragSession.cancel()
    transformSession.cancel()
  }, [dragSession, transformSession])

  return {
    handleNodeDoubleClick: (
      nodeId: NodeId,
      event: React.MouseEvent<HTMLDivElement>
    ) => {
      if (instance.view.tool.get() !== 'select') return

      const target = event.target
      if (target instanceof Element && target.closest(DOUBLE_CLICK_IGNORE_SELECTOR)) {
        return
      }

      const nodeEntry = instance.read.index.node.byId(nodeId)
      if (!nodeEntry || nodeEntry.node.type !== 'group') {
        return
      }

      instance.commands.selection.clear()
      instance.commands.container.enter(nodeId)
      event.preventDefault()
      event.stopPropagation()
    },
    handleNodePointerDown: dragSession.handleNodePointerDown,
    handleTransformPointerDown: transformSession.handleTransformPointerDown
  }
}
