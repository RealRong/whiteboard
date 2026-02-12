import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { Node, NodeId } from '@whiteboard/core'
import { selectNodeDragStrategy } from '../runtime/drag'
import { useInstance } from '../../common/hooks'
import type { DragState, NodeDragHandlers, NodeDragTransientApi } from 'types/node'

type UseNodeDragOptions = {
  node: Node
}

export const useNodeDrag = ({ node }: UseNodeDragOptions): NodeDragHandlers => {
  const instance = useInstance()
  const { nodeSize } = instance.runtime.config
  const core = instance.runtime.core

  const nodeId = node.id
  const nodeType = node.type
  const position = node.position
  const size = {
    width: node.size?.width ?? nodeSize.width,
    height: node.size?.height ?? nodeSize.height
  }

  const transient: NodeDragTransientApi = {
    setOverrides: instance.commands.transient.nodeOverrides.set,
    commitOverrides: instance.commands.transient.nodeOverrides.commit
  }

  const dragRef = useRef<DragState | null>(null)
  const hoverGroupRef = useRef<NodeId | undefined>(undefined)

  const strategy = selectNodeDragStrategy(nodeType)

  const updateHoverGroup = (next?: NodeId) => {
    hoverGroupRef.current = instance.commands.nodeDrag.updateHoverGroup(hoverGroupRef.current, next)
  }

  const clearHoverGroup = () => {
    hoverGroupRef.current = instance.commands.nodeDrag.clearHoverGroup(hoverGroupRef.current)
  }

  const onPointerDown: NodeDragHandlers['onPointerDown'] = (event) => {
    if (event.button !== 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const group = instance.commands.nodeDrag.getGroupContext()
    const children = strategy.initialize({
      core,
      nodeId,
      nodeType,
      position,
      size,
      group,
      transient,
      updateHoverGroup,
      getHoverGroupId: () => hoverGroupRef.current
    })

    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: position.x, y: position.y },
      last: { x: position.x, y: position.y },
      children
    }

    clearHoverGroup()
  }

  const onPointerMove: NodeDragHandlers['onPointerMove'] = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.start.x
    const dy = event.clientY - drag.start.y
    let nextPosition = {
      x: drag.origin.x + dx / Math.max(instance.runtime.viewport.getZoom(), 0.0001),
      y: drag.origin.y + dy / Math.max(instance.runtime.viewport.getZoom(), 0.0001)
    }

    nextPosition = instance.commands.nodeDrag.resolveMove({
      nodeId,
      position: nextPosition,
      size,
      childrenIds: drag.children?.ids,
      allowCross: event.altKey
    })

    drag.last = nextPosition

    strategy.handleMove({
      core,
      drag,
      nodeId,
      nodeType,
      position,
      size,
      group: instance.commands.nodeDrag.getGroupContext(),
      transient,
      updateHoverGroup,
      getHoverGroupId: () => hoverGroupRef.current,
      nextPosition
    })
  }

  const onPointerUp: NodeDragHandlers['onPointerUp'] = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    dragRef.current = null

    strategy.handlePointerUp({
      core,
      drag,
      nodeId,
      nodeType,
      position,
      size,
      group: instance.commands.nodeDrag.getGroupContext(),
      transient,
      updateHoverGroup,
      getHoverGroupId: () => hoverGroupRef.current
    })

    instance.commands.nodeDrag.clearGuides()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp
  }
}
