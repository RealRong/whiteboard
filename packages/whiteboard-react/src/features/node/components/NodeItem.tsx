import { memo, useCallback } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeContainerProps, NodeRenderProps } from 'types/node'
import { NodeBlock } from './NodeBlock'
import {
  buildNodeContainerStyle
} from './styles'
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
    shouldAutoMeasure,
    nodeStyle,
    transformStyle,
    renderProps: baseRenderProps,
    definition
  } = view
  const setMeasuredElement = useCallback((element: HTMLDivElement | null) => {
    registerMeasuredElement(nodeId, element, shouldAutoMeasure)
  }, [nodeId, registerMeasuredElement, shouldAutoMeasure])
  const measuredElementRef = definition?.autoMeasure ? setMeasuredElement : undefined

  const containerProps: NodeContainerProps = {
    rect,
    nodeId,
    selected,
    ref: measuredElementRef,
    style: buildNodeContainerStyle(nodeStyle, transformStyle),
    onPointerDown: (event) => {
      onNodePointerDown(nodeId, event)
    },
    onDoubleClick: (event) => {
      onNodeDoubleClick(nodeId, event)
    }
  }
  const renderProps: NodeRenderProps = {
    ...baseRenderProps,
    containerProps
  }
  const content = definition ? definition.render(renderProps) : resolvedNode.type

  return (
    definition?.renderContainer ? (
      definition.renderContainer(renderProps, content)
    ) : (
      <NodeBlock
        rect={rect}
        label={content}
        nodeId={nodeId}
        selected={selected}
        ref={containerProps.ref}
        style={containerProps.style}
        onPointerDown={containerProps.onPointerDown}
        onDoubleClick={containerProps.onDoubleClick}
      />
    )
  )
})

NodeItem.displayName = 'NodeItem'
