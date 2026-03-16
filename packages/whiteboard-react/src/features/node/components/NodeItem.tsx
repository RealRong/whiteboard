import { memo, useCallback, type CSSProperties } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeRenderProps } from '../../../types/node'
import { useNodeView } from '../hooks/useNodeView'

type NodeItemProps = {
  nodeId: NodeId
  registerMeasuredElement: (
    nodeId: NodeId,
    element: HTMLDivElement | null,
    enabled: boolean
  ) => void
  selected: boolean
  onNodePointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onNodeDoubleClick: (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void
}
export const NodeItem = memo(({
  nodeId,
  registerMeasuredElement,
  selected,
  onNodePointerDown,
  onNodeDoubleClick,
}: NodeItemProps) => {
  const view = useNodeView(nodeId, { selected })

  if (!view) return null

  const {
    node: resolvedNode,
    rect,
    hovered,
    hasResizePreview,
    nodeStyle,
    transformStyle,
    definition,
    update,
    updateData
  } = view
  const shouldAutoMeasure = Boolean(definition?.autoMeasure) && !hasResizePreview
  const setMeasuredElement = useCallback((element: HTMLDivElement | null) => {
    registerMeasuredElement(nodeId, element, shouldAutoMeasure)
  }, [nodeId, registerMeasuredElement, shouldAutoMeasure])
  const measuredElementRef = definition?.autoMeasure ? setMeasuredElement : undefined

  const rootStyle: CSSProperties = {
    ...nodeStyle,
    pointerEvents: 'auto',
    ...transformStyle
  }
  const renderProps: NodeRenderProps = {
    node: resolvedNode,
    rect,
    selected,
    hovered,
    update,
    updateData
  }
  const content = definition ? definition.render(renderProps) : resolvedNode.type

  return (
    <div
      ref={measuredElementRef}
      className="wb-node-block"
      data-node-id={nodeId}
      onPointerDown={(event) => {
        onNodePointerDown(nodeId, event)
      }}
      onDoubleClick={(event) => {
        onNodeDoubleClick(nodeId, event)
      }}
      style={{
        width: rect.width,
        height: rect.height,
        border: `1px solid ${selected ? '#3b82f6' : '#1d1d1f'}`,
        boxShadow: selected
          ? '0 0 0 2px rgba(59, 130, 246, 0.4)'
          : '0 6px 16px rgba(0, 0, 0, 0.08)',
        ...rootStyle
      }}
    >
      {content}
    </div>
  )
})

NodeItem.displayName = 'NodeItem'
